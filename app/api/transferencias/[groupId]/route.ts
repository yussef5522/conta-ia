// DELETE /api/transferencias/[groupId] — remove o par completo.
// Sprint 0.5 Dia 2. Reusa permission transaction.delete.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { deleteTransferGroup } from '@/lib/transfers/delete'
import { TransferValidationError } from '@/lib/transfers/validate'

interface Params {
  params: Promise<{ groupId: string }>
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { groupId } = await params

    // Resolve companyId via uma das pontas pra montar ctx correto
    const ponta = await prisma.transaction.findFirst({
      where: { transferGroupId: groupId },
      select: { bankAccount: { select: { companyId: true } } },
    })
    if (!ponta) {
      return NextResponse.json({ erro: 'Transferência não encontrada' }, { status: 404 })
    }

    const ctx = await getAuthContext(request, ponta.bankAccount.companyId)

    const result = await deleteTransferGroup(groupId, ctx, request)
    return NextResponse.json({
      mensagem: 'Transferência excluída com sucesso',
      ...result,
    })
  } catch (error) {
    if (error instanceof TransferValidationError) {
      return NextResponse.json({ erro: error.message }, { status: error.status })
    }
    return handleApiError(error)
  }
}
