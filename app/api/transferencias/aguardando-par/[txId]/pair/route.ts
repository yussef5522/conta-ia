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
          bankAccount: { select: { companyId: true } },
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
          bankAccount: { select: { companyId: true } },
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

    // Direction por SINAL (não pelo direction antigo do pending — pode ter
    // sido salvo errado): DEBIT = OUT, CREDIT = IN
    const pendingDirection: 'IN' | 'OUT' = pending.type === 'DEBIT' ? 'OUT' : 'IN'
    const pairDirection: 'IN' | 'OUT' = pair.type === 'DEBIT' ? 'OUT' : 'IN'

    const groupId = crypto.randomUUID()

    await prisma.$transaction(async (tx) => {
      // Pending → TRANSFER, limpa pendingTransfer
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
          notes:
            pending.notes?.replace('[V3:AGUARDANDO_PAR_TRANSFERENCIA]', '').trim() || null,
        },
      })
      // Pair → TRANSFER (mesmo grupo)
      await tx.transaction.update({
        where: { id: pair.id },
        data: {
          type: 'TRANSFER',
          transferGroupId: groupId,
          transferDirection: pairDirection,
          status: 'RECONCILED',
          // Pair também pode estar em pendingTransfer — limpa se for o caso
          pendingTransfer: false,
          pendingTransferDirection: null,
          pendingTransferSince: null,
          // Pair pode ter categoryId — se tinha, limpa (TRANSFER não é categoria)
          categoryId: null,
          notes:
            pair.notes?.replace('[V3:AGUARDANDO_PAR_TRANSFERENCIA]', '').trim() || null,
        },
      })
    })

    return NextResponse.json({
      ok: true,
      transferGroupId: groupId,
      pending: { id: pending.id, direction: pendingDirection },
      pair: { id: pair.id, direction: pairDirection },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
