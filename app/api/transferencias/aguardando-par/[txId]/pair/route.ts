// Sprint Pending Transfer State (27/06/2026, modelo QuickBooks/Xero).
//
// POST /api/transferencias/aguardando-par/[txId]/pair
// Body: { pairTxId: string }
//
// 1-click pairing: pega a tx aguardando par (txId) + candidata (pairTxId)
// e atomic vira as 2 em type='TRANSFER' + transferGroupId compartilhado +
// transferDirection IN/OUT + status='RECONCILED' + zera pendingTransfer.
//
// Validações duras (zero dupla contagem, saldo neutro entre contas):
//   1. Ambas mesma empresa (via bankAccount.companyId).
//   2. Contas DIFERENTES.
//   3. Mesmo valor (±R$ 0,01).
//   4. Sinais OPOSTOS (uma CREDIT, outra DEBIT).
//   5. txId está pendingTransfer=true; pairTxId está livre (não pareada).
//   6. Nenhuma tem transferGroupId.

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { classifyTransferPair, normalizeAccountKind } from '@/lib/accounts/kind'

interface Params { params: Promise<{ txId: string }> }

const bodySchema = z.object({
  pairTxId: z.string().cuid(),
})

const AMOUNT_TOL = 0.01

export const runtime = 'nodejs'

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { txId } = await params
    const body = bodySchema.parse(await request.json())

    const [pending, pair] = await prisma.$transaction([
      prisma.transaction.findUnique({
        where: { id: txId },
        select: {
          id: true,
          type: true,
          amount: true,
          date: true,
          pendingTransfer: true,
          transferGroupId: true,
          bankAccountId: true,
          notes: true,
          bankAccount: { select: { companyId: true, accountKind: true } },
        },
      }),
      prisma.transaction.findUnique({
        where: { id: body.pairTxId },
        select: {
          id: true,
          type: true,
          amount: true,
          date: true,
          pendingTransfer: true,
          transferGroupId: true,
          bankAccountId: true,
          categoryId: true,
          notes: true,
          bankAccount: { select: { companyId: true, accountKind: true } },
        },
      }),
    ])

    if (!pending || !pending.bankAccount) {
      return NextResponse.json({ erro: 'Tx aguardando par não encontrada' }, { status: 404 })
    }
    if (!pair || !pair.bankAccount) {
      return NextResponse.json({ erro: 'Tx candidata não encontrada' }, { status: 404 })
    }

    const ctx = await getAuthContext(request, pending.bankAccount.companyId)
    ctx.requirePermission('transaction.update')

    // 1. Mesma empresa
    if (pending.bankAccount.companyId !== pair.bankAccount.companyId) {
      return NextResponse.json(
        { erro: 'Pareamento cross-empresa não permitido', code: 'CROSS_COMPANY' },
        { status: 403 },
      )
    }

    // 2. Contas diferentes
    if (pending.bankAccountId === pair.bankAccountId) {
      return NextResponse.json(
        { erro: 'Par deve estar em CONTA DIFERENTE' },
        { status: 400 },
      )
    }

    // 3. Valores ±0,01
    if (Math.abs(pending.amount - pair.amount) > AMOUNT_TOL) {
      return NextResponse.json(
        { erro: `Valores diferentes (R$ ${pending.amount} vs R$ ${pair.amount})` },
        { status: 400 },
      )
    }

    // 4. Sinais opostos
    const opposite =
      (pending.type === 'DEBIT' && pair.type === 'CREDIT') ||
      (pending.type === 'CREDIT' && pair.type === 'DEBIT')
    if (!opposite) {
      return NextResponse.json(
        { erro: 'Sinais não são opostos (uma deve ser CREDIT, outra DEBIT)' },
        { status: 400 },
      )
    }

    // 5. pending DEVE estar pendingTransfer=true
    if (!pending.pendingTransfer) {
      return NextResponse.json(
        { erro: 'Tx não está marcada como aguardando par' },
        { status: 400 },
      )
    }

    // 6. Nenhuma com transferGroupId
    if (pending.transferGroupId || pair.transferGroupId) {
      return NextResponse.json(
        { erro: 'Alguma das tx já está em outro grupo de transferência' },
        { status: 409 },
      )
    }

    // Sprint Account Kind PJ/PF (27/06/2026): a CLASSIFICAÇÃO final depende
    // do accountKind dos 2 lados — NUNCA do nome do banco/dono.
    //   PJ + PJ → TRANSFER interna (sai do DRE)
    //   PJ + PF → APORTE (entrou na PJ) ou RETIRADA (saiu da PJ): cada lado
    //             vira tx categorizada como equity (NonDREGroup), preservando
    //             type=DEBIT/CREDIT (não vira TRANSFER artificial). Vai pro
    //             patrimônio, fora do DRE.
    const pendingKind = normalizeAccountKind(pending.bankAccount.accountKind)
    const pairKind = normalizeAccountKind(pair.bankAccount.accountKind)
    const classification = classifyTransferPair(
      pendingKind,
      pending.type as 'DEBIT' | 'CREDIT',
      pairKind,
    )

    if (classification.kind === 'TRANSFER_INTERNAL') {
      // PJ + PJ: clássico — vira TRANSFER + transferGroupId compartilhado
      const pendingDirection: 'IN' | 'OUT' = pending.type === 'DEBIT' ? 'OUT' : 'IN'
      const pairDirection: 'IN' | 'OUT' = pair.type === 'DEBIT' ? 'OUT' : 'IN'
      const groupId = crypto.randomUUID()

      await prisma.$transaction(async (tx) => {
        await tx.transaction.update({
          where: { id: pending.id },
          data: {
            type: 'TRANSFER',
            transferGroupId: groupId,
            transferDirection: pendingDirection,
            status: 'RECONCILED',
            pendingTransfer: false,
            pendingTransferDirection: null,
            pendingTransferSince: null,
            notes: pending.notes?.replace('[V3:AGUARDANDO_PAR_TRANSFERENCIA]', '').trim() || null,
          },
        })
        await tx.transaction.update({
          where: { id: pair.id },
          data: {
            type: 'TRANSFER',
            transferGroupId: groupId,
            transferDirection: pairDirection,
            status: 'RECONCILED',
            pendingTransfer: false,
            pendingTransferDirection: null,
            pendingTransferSince: null,
            categoryId: null,
            notes: pair.notes?.replace('[V3:AGUARDANDO_PAR_TRANSFERENCIA]', '').trim() || null,
          },
        })
      })

      return NextResponse.json({
        ok: true,
        classification: 'TRANSFER_INTERNAL',
        transferGroupId: groupId,
        pending: { id: pending.id, direction: pendingDirection },
        pair: { id: pair.id, direction: pairDirection },
      })
    }

    if (classification.kind === 'OUT_OF_SCOPE') {
      return NextResponse.json(
        { erro: 'Par PF↔PF não pertence a esta empresa', code: 'OUT_OF_SCOPE' },
        { status: 400 },
      )
    }

    // PJ + PF: aporte ou retirada — vai pro patrimônio (equity).
    // Cada lado MANTÉM o type original (DEBIT/CREDIT) — não vira TRANSFER —
    // e fica categorizado como "Aporte de Capital" (PF→PJ) ou "Retirada de
    // Lucros / Pró-labore" (PJ→PF). DRE pula via NonDREGroup.
    //
    // Sprint DRE Cleanup (28/06/2026, ACHADO #3): lookup DETERMINÍSTICO por
    // name + dreGroup. Antes era só name → quando havia duplicação no plano
    // de contas (caso Cacula: 2x "Aporte de Capital" — uma TRANSFERENCIA
    // antiga, outra APORTES_CAPITAL nova), o findFirst pegava qualquer.
    // Agora exige dreGroup correto (APORTES_CAPITAL ou DISTRIBUICAO_LUCROS).
    const targetCategoryName =
      classification.kind === 'APORTE_CAPITAL'
        ? 'Aporte de Capital'
        : 'Retirada de Lucros / Pró-labore'
    const targetCategoryDreGroup =
      classification.kind === 'APORTE_CAPITAL'
        ? 'APORTES_CAPITAL'
        : 'DISTRIBUICAO_LUCROS'

    const cat = await prisma.category.findFirst({
      where: {
        companyId: pending.bankAccount.companyId,
        name: targetCategoryName,
        dreGroup: targetCategoryDreGroup,
        isActive: true,
      },
      select: { id: true, dreGroup: true },
    })
    if (!cat) {
      return NextResponse.json(
        {
          erro: `Categoria de patrimônio "${targetCategoryName}" (dreGroup=${targetCategoryDreGroup}) não existe nesta empresa. Crie em /empresas/[id]/categorias antes de classificar pares PJ/PF.`,
          code: 'EQUITY_CATEGORY_MISSING',
        },
        { status: 422 },
      )
    }

    await prisma.$transaction(async (tx) => {
      // Pending: vira EQUITY classificada, sai de pendingTransfer
      await tx.transaction.update({
        where: { id: pending.id },
        data: {
          categoryId: cat.id,
          status: 'RECONCILED',
          cashCoded: true,
          cashCodedAt: new Date(),
          pendingTransfer: false,
          pendingTransferDirection: null,
          pendingTransferSince: null,
          notes:
            (pending.notes?.replace('[V3:AGUARDANDO_PAR_TRANSFERENCIA]', '').trim() ||
              '') + ` [PJ↔PF:${classification.kind}]`,
        },
      })
      // Pair: também classificada (mesma categoria de equity), sai de pendingTransfer
      await tx.transaction.update({
        where: { id: pair.id },
        data: {
          categoryId: cat.id,
          status: 'RECONCILED',
          cashCoded: true,
          cashCodedAt: new Date(),
          pendingTransfer: false,
          pendingTransferDirection: null,
          pendingTransferSince: null,
          notes:
            (pair.notes?.replace('[V3:AGUARDANDO_PAR_TRANSFERENCIA]', '').trim() ||
              '') + ` [PJ↔PF:${classification.kind}]`,
        },
      })
    })

    return NextResponse.json({
      ok: true,
      classification: classification.kind,
      pending: { id: pending.id },
      pair: { id: pair.id },
      categoryId: cat.id,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
