// GET /api/empresas/[id]/emprestimos/[loanId] — detalhe completo (KPIs + cronograma).

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'

interface Params {
  params: Promise<{ id: string; loanId: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId, loanId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.view')

    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      include: {
        bankAccount: { select: { id: true, name: true, bankName: true } },
        disbursementTransaction: {
          select: { id: true, date: true, amount: true, description: true },
        },
        installments: {
          orderBy: { number: 'asc' },
          include: {
            reconciledTransaction: {
              select: {
                id: true,
                date: true,
                amount: true,
                description: true,
                bankAccount: { select: { name: true } },
              },
            },
          },
        },
      },
    })
    if (!loan) {
      return NextResponse.json({ erro: 'Empréstimo não encontrado' }, { status: 404 })
    }
    if (loan.companyId !== empresaId) {
      return NextResponse.json({ erro: 'Empréstimo de outra empresa' }, { status: 403 })
    }

    const now = new Date()

    // Agregados
    const paid = loan.installments.filter((i) => i.status === 'PAID')
    const paidAmort = paid.reduce((s, i) => s + i.amortization, 0)
    const saldoDevedor = Math.round((loan.principal - paidAmort) * 100) / 100
    const jurosTotalContrato = loan.installments.reduce((s, i) => s + i.interest, 0)
    const jurosPagos = paid.reduce((s, i) => s + i.interest, 0)

    const proximaOpen = loan.installments.find((i) => i.status === 'OPEN')
    const isAtrasada =
      proximaOpen !== undefined && proximaOpen.dueDate.getTime() < now.getTime()

    // Marca status visual de cada parcela (LATE pro front)
    const installments = loan.installments.map((i) => {
      const statusUI: 'PAID' | 'OPEN' | 'LATE' =
        i.status === 'PAID'
          ? 'PAID'
          : i.dueDate.getTime() < now.getTime()
            ? 'LATE'
            : 'OPEN'
      return {
        number: i.number,
        dueDate: i.dueDate.toISOString(),
        openingBalance: i.openingBalance,
        interest: i.interest,
        amortization: i.amortization,
        payment: i.payment,
        closingBalance: i.closingBalance,
        status: statusUI,
        paidDate: i.paidDate?.toISOString() ?? null,
        reconciledTransaction: i.reconciledTransaction
          ? {
              id: i.reconciledTransaction.id,
              date: i.reconciledTransaction.date.toISOString(),
              amount: i.reconciledTransaction.amount,
              description: i.reconciledTransaction.description,
              accountName: i.reconciledTransaction.bankAccount?.name ?? null,
            }
          : null,
      }
    })

    // Pontos do gráfico = saldo devedor após cada parcela (closingBalance)
    const chartPoints = [
      { x: 0, label: 'Inicial', saldoDevedor: loan.principal },
      ...loan.installments.map((i) => ({
        x: i.number,
        label: i.dueDate.toISOString().slice(0, 7),
        saldoDevedor: i.closingBalance,
      })),
    ]

    return NextResponse.json({
      loan: {
        id: loan.id,
        lender: loan.lender,
        contractNumber: loan.contractNumber,
        principal: loan.principal,
        interestRateMonthly: loan.interestRateMonthly,
        termMonths: loan.termMonths,
        amortizationSystem: loan.amortizationSystem,
        firstDueDate: loan.firstDueDate.toISOString(),
        iof: loan.iof,
        disbursementDate: loan.disbursementDate.toISOString(),
        status: loan.status,
        bankAccount: loan.bankAccount,
        disbursementTransaction: loan.disbursementTransaction
          ? {
              id: loan.disbursementTransaction.id,
              date: loan.disbursementTransaction.date.toISOString(),
              amount: loan.disbursementTransaction.amount,
              description: loan.disbursementTransaction.description,
            }
          : null,
      },
      agregados: {
        saldoDevedor,
        jurosTotalContrato: Math.round(jurosTotalContrato * 100) / 100,
        jurosPagos: Math.round(jurosPagos * 100) / 100,
        principalAmortizado: Math.round(paidAmort * 100) / 100,
        parcelasPagas: paid.length,
        parcelasTotal: loan.installments.length,
        proximaParcela: proximaOpen
          ? {
              number: proximaOpen.number,
              dueDate: proximaOpen.dueDate.toISOString(),
              payment: proximaOpen.payment,
              interest: proximaOpen.interest,
              amortization: proximaOpen.amortization,
              isAtrasada,
            }
          : null,
      },
      installments,
      chartPoints,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE — remove o Loan inteiro (cascade installments). Tx OFX permanecem.
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId, loanId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.delete')

    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      select: { companyId: true },
    })
    if (!loan) return NextResponse.json({ erro: 'Não encontrado' }, { status: 404 })
    if (loan.companyId !== empresaId) {
      return NextResponse.json({ erro: 'Empréstimo de outra empresa' }, { status: 403 })
    }

    // Limpa reconciledTransactionId antes (FK SetNull já cuida, mas explícito)
    await prisma.loanInstallment.updateMany({
      where: { loanId },
      data: { reconciledTransactionId: null },
    })
    await prisma.loan.delete({ where: { id: loanId } })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
