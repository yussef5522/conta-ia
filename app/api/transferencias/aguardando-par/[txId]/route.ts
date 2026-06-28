// Sprint Pending Transfer State (27/06/2026).
//
// DELETE /api/transferencias/aguardando-par/[txId]
//   "Não é transferência" — reverte pendingTransfer=false + limpa direction
//   + Since + (opcional) limpa notes marcador. Volta a ser tx categorizável.
//
// POST /api/transferencias/aguardando-par/[txId]/pair  (em route separado)
//   1-click pairing — usa endpoint sibling.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'

interface Params { params: Promise<{ txId: string }> }

export const runtime = 'nodejs'

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { txId } = await params

    // Carrega tx com companyId via bankAccount pro RBAC
    const tx = await prisma.transaction.findUnique({
      where: { id: txId },
      select: {
        id: true,
        pendingTransfer: true,
        notes: true,
        bankAccount: { select: { companyId: true } },
      },
    })
    if (!tx || !tx.bankAccount) {
      return NextResponse.json({ erro: 'Tx não encontrada' }, { status: 404 })
    }
    const ctx = await getAuthContext(request, tx.bankAccount.companyId)
    ctx.requirePermission('transaction.update')

    if (!tx.pendingTransfer) {
      // Idempotente: já não está aguardando par
      return NextResponse.json({ ok: true, alreadyClean: true })
    }

    // Limpa nota marcadora se presente
    const cleanedNotes = tx.notes?.replace('[V3:AGUARDANDO_PAR_TRANSFERENCIA]', '').trim() ?? null

    await prisma.transaction.update({
      where: { id: txId },
      data: {
        pendingTransfer: false,
        pendingTransferDirection: null,
        pendingTransferSince: null,
        notes: cleanedNotes && cleanedNotes.length > 0 ? cleanedNotes : null,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
