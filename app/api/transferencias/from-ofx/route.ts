// POST /api/transferencias/from-ofx
// Sprint 0.5 Dia 4 (refinamento): pareamento "Replace" no preview OFX.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { fromOfxSchema, createTransferFromOfx } from '@/lib/transfers/from-ofx'
import { TransferValidationError } from '@/lib/transfers/validate'
import { DuplicateTransferGroupError } from '@/lib/transfers/check-duplicate-group'
import { BalanceCheckError } from '@/lib/balance/check'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const input = fromOfxSchema.parse(body)

    // Resolve companyId via importingAccount pra montar ctx
    const importingAccount = await prisma.bankAccount.findUnique({
      where: { id: input.importingAccountId },
      select: { id: true, companyId: true },
    })
    if (!importingAccount) {
      return NextResponse.json(
        { erro: 'Conta importada não encontrada' },
        { status: 404 },
      )
    }

    const ctx = await getAuthContext(request, importingAccount.companyId)
    const result = await createTransferFromOfx(input, ctx, request)
    return NextResponse.json({ transferencia: result }, { status: 201 })
  } catch (error) {
    if (error instanceof BalanceCheckError) {
      return NextResponse.json(
        { erro: error.message, saldoCheck: error.result },
        { status: error.status },
      )
    }
    if (error instanceof DuplicateTransferGroupError) {
      return NextResponse.json(
        {
          erro: error.message,
          code: error.code,
          existingGroupId: error.existing.groupId,
          existingGroupDate: error.existing.date.toISOString(),
        },
        { status: error.status },
      )
    }
    if (error instanceof TransferValidationError) {
      return NextResponse.json({ erro: error.message }, { status: error.status })
    }
    return handleApiError(error)
  }
}
