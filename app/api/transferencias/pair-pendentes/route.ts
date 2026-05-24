// POST /api/transferencias/pair-pendentes
// Vincula 2 transações PENDING como par TRANSFER atomic. Sprint 1.7.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { pairPendentesSchema, pairPendentes } from '@/lib/transfers/pair-pendentes'
import { TransferValidationError } from '@/lib/transfers/validate'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const input = pairPendentesSchema.parse(body)

    // Resolve companyId via uma das transações pra montar ctx
    const ponta = await prisma.transaction.findUnique({
      where: { id: input.transacaoIdA },
      select: { bankAccount: { select: { companyId: true } } },
    })
    if (!ponta) {
      return NextResponse.json(
        { erro: 'Transação A não encontrada' },
        { status: 404 },
      )
    }

    const ctx = await getAuthContext(request, ponta.bankAccount!.companyId)
    const result = await pairPendentes(input, ctx, request)
    return NextResponse.json({ transferencia: result }, { status: 201 })
  } catch (error) {
    if (error instanceof TransferValidationError) {
      return NextResponse.json({ erro: error.message }, { status: error.status })
    }
    return handleApiError(error)
  }
}
