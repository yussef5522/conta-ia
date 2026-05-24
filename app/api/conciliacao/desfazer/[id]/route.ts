// Sprint 4.0.2 — POST /api/conciliacao/desfazer/[id]
// Reverte conciliação: lifecycle volta pra PAYABLE/RECEIVABLE, paymentDate=null,
// bankAccountId=null, reconciledWithId=null.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import {
  undoReconciliation,
  ReconciliationError,
} from '@/lib/conciliacao/reconcile'

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params

    // Resolve companyId via tx
    const tx = await prisma.transaction.findUnique({
      where: { id },
      select: {
        bankAccount: { select: { companyId: true } },
        supplier: { select: { companyId: true } },
        customer: { select: { companyId: true } },
        category: { select: { companyId: true } },
      },
    })
    if (!tx) {
      return NextResponse.json({ erro: 'Transação não encontrada' }, { status: 404 })
    }
    const companyId =
      tx.bankAccount?.companyId ??
      tx.supplier?.companyId ??
      tx.customer?.companyId ??
      tx.category?.companyId
    if (!companyId) {
      return NextResponse.json({ erro: 'Empresa não resolvida' }, { status: 422 })
    }

    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.update')

    const reverted = await undoReconciliation(id, ctx)
    return NextResponse.json({ ok: true, transaction: reverted })
  } catch (error) {
    if (error instanceof ReconciliationError) {
      return NextResponse.json({ erro: error.reason }, { status: error.status })
    }
    return handleApiError(error)
  }
}
