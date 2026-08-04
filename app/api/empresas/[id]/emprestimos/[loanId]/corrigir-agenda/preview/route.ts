// Sprint Empréstimo Débito Parcial (03/08/2026) — PASSO 4: preview da correção
// de agenda. READ-ONLY: regenera com a parcela+taxa reais, roda o guard e mostra
// antes/depois + impacto nas reconciliadas. NÃO grava nada.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { regenerateSchedule } from '@/lib/loans/regenerate'

export const runtime = 'nodejs'
interface Params { params: Promise<{ id: string; loanId: string }> }

const bodySchema = z.object({
  parcela: z.number().positive(),
  rateMonthly: z.number().min(0).max(1), // 0..100% a.m.
  isPostFixed: z.boolean(),
})

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId, loanId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.update')

    const body = bodySchema.parse(await request.json())

    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      select: {
        companyId: true, principal: true, outstandingBalanceInitial: true, termMonths: true,
        installmentsPaidBefore: true, amortizationSystem: true, amortizationConstant: true,
        firstDueDate: true, contractNumber: true, lender: true,
        interestRateMonthly: true, rateType: true,
      },
    })
    if (!loan) return NextResponse.json({ erro: 'Empréstimo não encontrado' }, { status: 404 })
    if (loan.companyId !== empresaId) return NextResponse.json({ erro: 'Outra empresa' }, { status: 403 })

    const installments = await prisma.loanInstallment.findMany({
      where: { loanId },
      orderBy: { number: 'asc' },
      select: {
        number: true, dueDate: true, openingBalance: true, interest: true, amortization: true,
        correcao: true, payment: true, closingBalance: true, status: true, isEstimate: true,
        reconciledTransactionId: true, realPayment: true,
      },
    })

    const result = regenerateSchedule(
      {
        principal: loan.principal, outstandingBalanceInitial: loan.outstandingBalanceInitial,
        termMonths: loan.termMonths, installmentsPaidBefore: loan.installmentsPaidBefore,
        amortizationSystem: loan.amortizationSystem as 'PRICE' | 'SAC',
        amortizationConstant: loan.amortizationConstant, firstDueDate: loan.firstDueDate,
      },
      installments,
      { parcela: body.parcela, rateMonthly: body.rateMonthly, isPostFixed: body.isPostFixed },
    )

    // Antes = só a faixa RASTREADA (>= startNumber) pra comparar com o depois.
    const startNumber = loan.installmentsPaidBefore + 1
    const antes = installments
      .filter((i) => i.number >= startNumber)
      .map((i) => ({
        number: i.number, dueDate: i.dueDate, openingBalance: i.openingBalance,
        interest: i.interest, amortization: i.amortization, correcao: i.correcao,
        payment: i.payment, closingBalance: i.closingBalance, status: i.status, isEstimate: i.isEstimate,
      }))

    return NextResponse.json({
      loan: {
        contractNumber: loan.contractNumber, lender: loan.lender,
        interestRateMonthly: loan.interestRateMonthly, rateType: loan.rateType,
        amortizationSystem: loan.amortizationSystem, base: result.base,
      },
      antes,
      depois: result.rows,
      validation: result.validation,
      reconciled: result.reconciled,
      reconciledCount: result.reconciled.length,
      blocked: result.blocked,
      blockReason: result.blockReason,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
