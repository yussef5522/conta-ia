// Sprint Account Kind PJ/PF (27/06/2026).
//
// POST /api/transferencias/aguardando-par/[txId]/classify-equity
// Body: { kind: 'APORTE_CAPITAL' | 'RETIRADA_LUCRO' }
//
// Quando o dinheiro veio/foi de uma conta PF que NÃO está cadastrada no
// sistema, o user marca manualmente como aporte ou retirada. A tx vira
// EQUITY (NonDREGroup), sai do DRE e da fila "Aguardando par".

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'

interface Params { params: Promise<{ txId: string }> }

const bodySchema = z.object({
  kind: z.enum(['APORTE_CAPITAL', 'RETIRADA_LUCRO']),
})

export const runtime = 'nodejs'

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { txId } = await params
    const body = bodySchema.parse(await request.json())

    const tx = await prisma.transaction.findUnique({
      where: { id: txId },
      select: {
        id: true,
        type: true,
        notes: true,
        pendingTransfer: true,
        bankAccount: { select: { companyId: true } },
      },
    })
    if (!tx || !tx.bankAccount) {
      return NextResponse.json({ erro: 'Tx não encontrada' }, { status: 404 })
    }

    const ctx = await getAuthContext(request, tx.bankAccount.companyId)
    ctx.requirePermission('transaction.update')

    // Coerência: APORTE = entrou na PJ (CREDIT). RETIRADA = saiu da PJ (DEBIT).
    if (body.kind === 'APORTE_CAPITAL' && tx.type !== 'CREDIT') {
      return NextResponse.json(
        { erro: 'Aporte deve ser uma entrada (CREDIT)', code: 'TYPE_MISMATCH' },
        { status: 400 },
      )
    }
    if (body.kind === 'RETIRADA_LUCRO' && tx.type !== 'DEBIT') {
      return NextResponse.json(
        { erro: 'Retirada deve ser uma saída (DEBIT)', code: 'TYPE_MISMATCH' },
        { status: 400 },
      )
    }

    // Sprint DRE Cleanup (28/06/2026, ACHADO #3): lookup determinístico por
    // name + dreGroup — antes era só name, pegando qualquer duplicata do
    // plano de contas.
    const targetCategoryName =
      body.kind === 'APORTE_CAPITAL' ? 'Aporte de Capital' : 'Retirada de Lucros / Pró-labore'
    const targetCategoryDreGroup =
      body.kind === 'APORTE_CAPITAL' ? 'APORTES_CAPITAL' : 'DISTRIBUICAO_LUCROS'

    const cat = await prisma.category.findFirst({
      where: {
        companyId: tx.bankAccount.companyId,
        name: targetCategoryName,
        dreGroup: targetCategoryDreGroup,
        isActive: true,
      },
      select: { id: true },
    })
    if (!cat) {
      return NextResponse.json(
        {
          erro: `Categoria "${targetCategoryName}" (dreGroup=${targetCategoryDreGroup}) não cadastrada. Crie em /empresas/[id]/categorias.`,
          code: 'EQUITY_CATEGORY_MISSING',
        },
        { status: 422 },
      )
    }

    await prisma.transaction.update({
      where: { id: txId },
      data: {
        categoryId: cat.id,
        status: 'RECONCILED',
        cashCoded: true,
        cashCodedAt: new Date(),
        pendingTransfer: false,
        pendingTransferDirection: null,
        pendingTransferSince: null,
        notes:
          (tx.notes?.replace('[V3:AGUARDANDO_PAR_TRANSFERENCIA]', '').trim() || '') +
          ` [EQUITY:${body.kind}]`,
      },
    })

    return NextResponse.json({ ok: true, classification: body.kind, categoryId: cat.id })
  } catch (error) {
    return handleApiError(error)
  }
}
