// GET /api/empresas/.../parcelas/[number]/candidatos — debits que podem ser a parcela.
//
// Sprint Pagamento Parcela Redesign (28/06/2026, nível Xero/QuickBooks):
//   - Aceita origin IN ('OFX','PDF','MANUAL') (antes só 'OFX')
//   - Tolerância de valor por isEstimate (pré ±R$1, pós-fixado até +25%)
//   - Calcula confidenceScore + split contábil pra cada candidato

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import {
  isTxInMatchWindow,
  computeMatchConfidence,
  computePosFixedSplit,
  computePreFixedSplit,
  DATE_WINDOW_DAYS,
  POS_FIXED_AMOUNT_TOL_PCT,
  PRE_FIXED_AMOUNT_TOL_ABS,
} from '@/lib/loans/installment-match'

interface Params {
  params: Promise<{ id: string; loanId: string; number: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId, loanId, number: numStr } = await params
    const number = parseInt(numStr, 10)
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.view')

    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      select: {
        companyId: true,
        bankAccountId: true,
        contractNumber: true,
        lender: true,
        interestRateMonthly: true,
      },
    })
    if (!loan || loan.companyId !== empresaId) {
      return NextResponse.json({ erro: 'Não encontrado' }, { status: 404 })
    }
    const installment = await prisma.loanInstallment.findFirst({
      where: { loanId, number },
      select: {
        id: true,
        dueDate: true,
        payment: true,
        interest: true,
        amortization: true,
        openingBalance: true,
        isEstimate: true,
        status: true,
      },
    })
    if (!installment) {
      return NextResponse.json({ erro: 'Parcela não encontrada' }, { status: 404 })
    }

    const minAmount = installment.payment - PRE_FIXED_AMOUNT_TOL_ABS
    const maxAmount = installment.isEstimate
      ? installment.payment * (1 + POS_FIXED_AMOUNT_TOL_PCT)
      : installment.payment + PRE_FIXED_AMOUNT_TOL_ABS

    const ms = DATE_WINDOW_DAYS * 86400_000
    const candidatesRaw = await prisma.transaction.findMany({
      where: {
        bankAccountId: loan.bankAccountId,
        type: 'DEBIT',
        origin: { in: ['OFX', 'PDF', 'MANUAL'] },
        loanInstallmentPaid: null,
        date: {
          gte: new Date(installment.dueDate.getTime() - ms),
          lte: new Date(installment.dueDate.getTime() + ms),
        },
        amount: { gte: minAmount, lte: maxAmount },
      },
      select: { id: true, date: true, amount: true, description: true, origin: true },
      orderBy: [{ date: 'asc' }, { amount: 'desc' }],
      take: 15,
    })

    const candidates = candidatesRaw
      .filter((c) =>
        isTxInMatchWindow(
          {
            payment: installment.payment,
            dueDate: installment.dueDate,
            isEstimate: installment.isEstimate,
          },
          { amount: c.amount, date: c.date, type: 'DEBIT' },
        ),
      )
      .map((c) => {
        const confidence = computeMatchConfidence(
          {
            payment: installment.payment,
            dueDate: installment.dueDate,
            isEstimate: installment.isEstimate,
          },
          { amount: c.amount, date: c.date },
        )
        const split = installment.isEstimate
          ? computePosFixedSplit(
              {
                amortization: installment.amortization,
                openingBalance: installment.openingBalance,
              },
              c.amount,
              loan.interestRateMonthly,
            )
          : computePreFixedSplit({
              interest: installment.interest,
              amortization: installment.amortization,
              payment: installment.payment,
              openingBalance: installment.openingBalance,
            })
        return {
          id: c.id,
          date: c.date.toISOString(),
          amount: c.amount,
          description: c.description,
          origin: c.origin,
          amountDiff: Math.round((c.amount - installment.payment) * 100) / 100,
          daysDiff: Math.round((c.date.getTime() - installment.dueDate.getTime()) / 86400_000),
          confidence,
          split,
        }
      })
      .sort(
        (a, b) =>
          b.confidence.score - a.confidence.score ||
          Math.abs(a.daysDiff) - Math.abs(b.daysDiff),
      )

    return NextResponse.json({
      installmentNumber: number,
      contractNumber: loan.contractNumber,
      lender: loan.lender,
      dueDate: installment.dueDate.toISOString(),
      payment: installment.payment,
      interest: installment.interest,
      amortization: installment.amortization,
      openingBalance: installment.openingBalance,
      isEstimate: installment.isEstimate,
      rateMonthly: loan.interestRateMonthly,
      candidates,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
