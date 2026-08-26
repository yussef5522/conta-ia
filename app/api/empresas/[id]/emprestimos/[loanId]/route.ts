// GET /api/empresas/[id]/emprestimos/[loanId] — detalhe completo (KPIs + cronograma).

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { saldoDevedorAtual } from '@/lib/loans/saldo'

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
            // ⚠️ A SEGUNDA PORTA (26/08). "Pago" tem DOIS mecanismos: 1:1
            // (reconciledTransactionId) e N:1 (LoanInstallmentPayment, débito parcial).
            // A tela lia só a primeira → parcela paga em 3 mordidas aparecia como um
            // "pago" SECO, sem dizer quando nem quanto entrou em cada uma. É a mesma
            // omissão que em 14/08 fez 8 parcelas passarem por "órfãs" sendo linkadas.
            payments: {
              orderBy: { createdAt: 'asc' },
              select: {
                id: true,
                amount: true,
                transaction: {
                  select: { id: true, date: true, description: true, bankAccount: { select: { name: true } } },
                },
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

    // Mútuo FLEXIBLE (sem prazo fixo — Arafat): agenda de 7x é NOMINAL. Sem
    // próxima parcela, sem "atrasada", progresso em VALOR (devolvido/base).
    const flexible = loan.scheduleSource === 'FLEXIBLE'

    // Agregados
    const paid = loan.installments.filter((i) => i.status === 'PAID')
    const paidAmort = paid.reduce((s, i) => s + i.amortization, 0)
    // FIX saldo (04/08): agenda válida → closingBalance da última paga; inválida →
    // fórmula conservadora. Fonte única em lib/loans/saldo.ts.
    const saldoDevedor = saldoDevedorAtual(loan, loan.installments)
    const jurosTotalContrato = loan.installments.reduce((s, i) => s + i.interest, 0)
    const jurosPagos = paid.reduce((s, i) => s + i.interest, 0)

    // FLEXIBLE: quanto já foi devolvido = base original − saldo atual.
    const devolvido = Math.round((loan.principal - saldoDevedor) * 100) / 100
    const progressoValor = loan.principal > 0 ? Math.round((devolvido / loan.principal) * 100) : 0

    // Histórico de devoluções (2.5): cada parcela paga com data + valor devolvido.
    const historicoDevolucoes = paid
      .filter((i) => i.paidDate)
      .sort((a, b) => (a.paidDate!.getTime() - b.paidDate!.getTime()))
      .map((i) => ({
        number: i.number,
        date: i.paidDate!.toISOString(),
        valor: Math.round((i.paidTotal ?? i.amortization) * 100) / 100,
      }))

    const proximaOpen = flexible ? undefined : loan.installments.find((i) => i.status === 'OPEN')
    const isAtrasada =
      proximaOpen !== undefined && proximaOpen.dueDate.getTime() < now.getTime()

    // Marca status visual de cada parcela (LATE pro front). FLEXIBLE nunca LATE.
    const installments = loan.installments.map((i) => {
      const statusUI: 'PAID' | 'OPEN' | 'LATE' =
        i.status === 'PAID'
          ? 'PAID'
          : flexible
            ? 'OPEN'
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
        // mordidas do débito parcial (N:1), ordenadas por entrada
        pagamentos: i.payments.map((pg) => ({
          id: pg.id,
          amount: pg.amount,
          date: pg.transaction?.date.toISOString() ?? null,
          description: pg.transaction?.description ?? null,
          accountName: pg.transaction?.bankAccount?.name?.trim() ?? null,
          transactionId: pg.transaction?.id ?? null,
        })),
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
        carencia: loan.carencia,
        amortizationSystem: loan.amortizationSystem,
        firstDueDate: loan.firstDueDate.toISOString(),
        iof: loan.iof,
        disbursementDate: loan.disbursementDate.toISOString(),
        status: loan.status,
        // Fix detalhe EM_ANDAMENTO (17/06/2026): expõe campos pra UI detectar
        // que o empréstimo entrou pelo saldo devedor (não pelo principal).
        // Quando outstandingBalanceInitial != null, é em-andamento → badge
        // de "liberação não linkada" NÃO se aplica (liberação foi anterior
        // ao período do CAIXAOS, nunca entrou como receita no DRE).
        outstandingBalanceInitial: loan.outstandingBalanceInitial,
        installmentsPaidBefore: loan.installmentsPaidBefore,
        trackingStartDate: loan.trackingStartDate?.toISOString() ?? null,
        rateType: loan.rateType,
        indexer: loan.indexer,
        indexerPercent: loan.indexerPercent,
        scheduleSource: loan.scheduleSource,
        flexible,
        notes: loan.notes,
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
        // FLEXIBLE: progresso em VALOR (devolvido de base), não por parcela (2.2).
        devolvido: flexible ? devolvido : null,
        valorBase: flexible ? loan.principal : null,
        progressoValor: flexible ? progressoValor : null,
        historicoDevolucoes: flexible ? historicoDevolucoes : null,
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
