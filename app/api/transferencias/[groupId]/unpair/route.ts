// Sprint Transferências Redesign (28/06/2026, Mercury/Ramp).
//
// POST /api/transferencias/[groupId]/unpair
//
// "Desfazer par" SEGURO: dispara o transferGroupId, mas mantém as 2 tx no
// banco (NÃO afeta saldo). As 2 voltam pra type=DEBIT/CREDIT original,
// pendingTransfer=true (volta pra fila Revisar pro user reclassificar).
//
// Filosofia: nunca apaga sozinho. Desfazer ≠ excluir. Excluir é endpoint
// dedicado (DELETE /api/transferencias/[groupId]) que apaga as tx.
//
// Multi-tenant: companyId resolvido via uma das pontas.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'

interface Params { params: Promise<{ groupId: string }> }

export const runtime = 'nodejs'

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { groupId } = await params

    // Carrega as 2 pontas + companyId pra RBAC
    const txs = await prisma.transaction.findMany({
      where: { transferGroupId: groupId },
      select: {
        id: true,
        type: true,
        transferDirection: true,
        notes: true,
        categoryId: true,
        bankAccount: { select: { companyId: true } },
      },
    })

    if (txs.length === 0) {
      return NextResponse.json(
        { erro: 'Transferência não encontrada', code: 'NOT_FOUND' },
        { status: 404 },
      )
    }

    const companyId = txs[0].bankAccount?.companyId
    if (!companyId) {
      return NextResponse.json(
        { erro: 'Ponta sem empresa associada', code: 'INVALID_STATE' },
        { status: 422 },
      )
    }

    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.update')

    // Reverter cada ponta:
    //   type=TRANSFER → volta pra DEBIT (OUT) ou CREDIT (IN) pela direction
    //   transferGroupId = null, transferDirection = null
    //   pendingTransfer = true (volta pra fila Revisar pro user reclassificar)
    //   status = PENDING
    //   categoryId = null (se era equity PJ+PF, limpa pra reclassificar)
    //   notes: limpa markers [V3:AGUARDANDO_PAR_TRANSFERENCIA] e [PJ↔PF:...]
    await prisma.$transaction(async (tx) => {
      for (const t of txs) {
        const originalType: 'DEBIT' | 'CREDIT' =
          t.transferDirection === 'OUT' ? 'DEBIT' : 'CREDIT'
        const cleanedNotes =
          (t.notes ?? '')
            .replace(/\[V3:AGUARDANDO_PAR_TRANSFERENCIA\]/g, '')
            .replace(/\[PJ↔PF:[^\]]+\]/g, '')
            .trim() || null

        await tx.transaction.update({
          where: { id: t.id },
          data: {
            type: originalType,
            transferGroupId: null,
            transferDirection: null,
            // Volta pra fila Revisar (pendingTransfer=true) — pode ser
            // reclassificada como TRANSFER, Aporte/Retirada, ou "não é
            // transferência" (volta pra categorizar como receita/despesa).
            pendingTransfer: true,
            pendingTransferDirection: t.transferDirection === 'OUT' ? 'OUT' : 'IN',
            pendingTransferSince: new Date(),
            status: 'PENDING',
            categoryId: null,
            cashCoded: false,
            notes: cleanedNotes,
          },
        })
      }
    })

    return NextResponse.json({
      ok: true,
      unpaired: txs.length,
      ids: txs.map((t) => t.id),
    })
  } catch (error) {
    return handleApiError(error)
  }
}
