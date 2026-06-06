// POST /api/empresas/[id]/transferencias/sugestoes/recusar
// Body: { fromTxId, toTxId }
//
// Marca AMBAS as tx como dismissed pra varredura retroativa não voltar a
// sugerir. Não muda o conteúdo da tx — só seta transferDismissedAt.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { logAudit } from '@/lib/audit'

interface Params {
  params: Promise<{ id: string }>
}

const schema = z.object({
  fromTxId: z.string().cuid(),
  toTxId: z.string().cuid(),
})

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.update')

    const body = await request.json()
    const { fromTxId, toTxId } = schema.parse(body)

    const tx1 = await prisma.transaction.findUnique({
      where: { id: fromTxId },
      include: { bankAccount: { select: { companyId: true } } },
    })
    const tx2 = await prisma.transaction.findUnique({
      where: { id: toTxId },
      include: { bankAccount: { select: { companyId: true } } },
    })
    if (!tx1 || !tx2) {
      return NextResponse.json(
        { erro: 'Transação não encontrada' },
        { status: 404 },
      )
    }
    if (
      tx1.bankAccount?.companyId !== empresaId ||
      tx2.bankAccount?.companyId !== empresaId
    ) {
      return NextResponse.json(
        { erro: 'Transação de outra empresa' },
        { status: 403 },
      )
    }

    const now = new Date()
    await prisma.transaction.updateMany({
      where: { id: { in: [fromTxId, toTxId] } },
      data: { transferDismissedAt: now },
    })

    void logAudit(ctx, {
      action: 'UPDATE',
      entityType: 'Transaction',
      entityId: fromTxId,
      fieldsChanged: {
        transferDismissedAt: { before: null, after: now.toISOString() },
      },
      metadata: {
        mode: 'TRANSFER_SUGGESTION_DISMISSED',
        otherTxId: toTxId,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
