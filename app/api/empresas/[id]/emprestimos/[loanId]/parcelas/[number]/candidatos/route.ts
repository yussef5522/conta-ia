// GET /api/empresas/.../parcelas/[number]/candidatos — debits que podem ser a parcela
// pra marcação manual quando contractNumber não bate.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'

interface Params {
  params: Promise<{ id: string; loanId: string; number: string }>
}

const WINDOW_DAYS = 7
const AMOUNT_TOL = 1.0

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId, loanId, number: numStr } = await params
    const number = parseInt(numStr, 10)
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.view')

    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      select: { companyId: true, bankAccountId: true },
    })
    if (!loan || loan.companyId !== empresaId) {
      return NextResponse.json({ erro: 'Não encontrado' }, { status: 404 })
    }
    const installment = await prisma.loanInstallment.findFirst({
      where: { loanId, number },
      select: { id: true, dueDate: true, payment: true, status: true },
    })
    if (!installment) {
      return NextResponse.json({ erro: 'Parcela não encontrada' }, { status: 404 })
    }

    const ms = WINDOW_DAYS * 86400000
    const candidates = await prisma.transaction.findMany({
      where: {
        bankAccountId: loan.bankAccountId,
        type: 'DEBIT',
        origin: 'OFX',
        loanInstallmentPaid: null,
        date: {
          gte: new Date(installment.dueDate.getTime() - ms),
          lte: new Date(installment.dueDate.getTime() + ms),
        },
        amount: { gte: installment.payment - AMOUNT_TOL, lte: installment.payment + AMOUNT_TOL },
      },
      select: { id: true, date: true, amount: true, description: true },
      orderBy: [{ date: 'asc' }, { amount: 'desc' }],
      take: 15,
    })

    return NextResponse.json({
      installmentNumber: number,
      dueDate: installment.dueDate.toISOString(),
      payment: installment.payment,
      candidates: candidates.map((c) => ({
        id: c.id,
        date: c.date.toISOString(),
        amount: c.amount,
        description: c.description,
        amountDiff: Math.round((c.amount - installment.payment) * 100) / 100,
        daysDiff: Math.round((c.date.getTime() - installment.dueDate.getTime()) / 86400000),
      })),
    })
  } catch (error) {
    return handleApiError(error)
  }
}
