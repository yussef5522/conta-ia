// Sprint Casar Pagamento (04/08/2026) — FASE 4: dados do painel de vínculo N:1.
// READ-ONLY. Mostra a parcela alvo, os lançamentos do contrato já agrupados, o
// split (amortização fora do DRE + encargos despesa financeira) e saldo antes→
// depois. Janela JUL–AGO/2026. Nada grava.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { buildLinkGroup, computeLinkSplit, storedScheduleValid } from '@/lib/loans/link-payment'

export const runtime = 'nodejs'
interface Params { params: Promise<{ id: string; loanId: string }> }

const WINDOW_START = new Date('2026-07-01T00:00:00.000Z')
const WINDOW_END = new Date('2026-08-31T23:59:59.999Z')

const bodySchema = z.object({
  installmentNumber: z.number().int().positive().optional(),
  transactionIds: z.array(z.string()).optional(),
  // tx que originou o clique — SEMPRE entra pré-selecionada no grupo (BUG 1).
  originTxId: z.string().optional(),
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
        companyId: true, bankAccountId: true, contractNumber: true, lender: true,
        interestRateMonthly: true, rateType: true, installmentsPaidBefore: true,
      },
    })
    if (!loan) return NextResponse.json({ erro: 'Empréstimo não encontrado' }, { status: 404 })
    if (loan.companyId !== empresaId) return NextResponse.json({ erro: 'Outra empresa' }, { status: 403 })

    const installments = await prisma.loanInstallment.findMany({
      where: { loanId }, orderBy: { number: 'asc' },
      select: { number: true, dueDate: true, amortization: true, openingBalance: true, closingBalance: true, interest: true, correcao: true, payment: true, status: true, isEstimate: true },
    })
    const startNumber = loan.installmentsPaidBefore + 1
    const openList = installments.filter((i) => i.number >= startNumber && i.status !== 'PAID')
    const target = body.installmentNumber
      ? installments.find((i) => i.number === body.installmentNumber)
      : openList[0]
    if (!target) return NextResponse.json({ erro: 'Nenhuma parcela em aberto pra vincular' }, { status: 400 })

    // Candidatos: DEBIT pendentes da conta, na janela, ainda não vinculados, que
    // batem com o contrato (Sicredi tem nº na descrição; outros bancos: sem nº,
    // caem aqui só se o nº bater — pra keyword-only o painel é aberto manualmente).
    const pend = await prisma.transaction.findMany({
      where: {
        bankAccountId: loan.bankAccountId, type: 'DEBIT', lifecycle: 'EFFECTED',
        date: { gte: WINDOW_START, lte: WINDOW_END },
        loanInstallmentPaid: { is: null }, loanInstallmentPayments: { none: {} },
      },
      orderBy: { date: 'asc' },
      select: { id: true, description: true, amount: true, date: true },
    })
    const group = buildLinkGroup({
      pend, contractNumber: loan.contractNumber, originTxId: body.originTxId, transactionIds: body.transactionIds,
    })
    const paidTotal = group.paidTotal

    const split = computeLinkSplit({
      installment: { amortization: target.amortization, openingBalance: target.openingBalance },
      rateMonthly: loan.interestRateMonthly, paidTotal,
    })

    // Agenda armazenada fecha? (decide se o split flui pro DRE — FASE 5.3)
    const tracked = installments.filter((i) => i.number >= startNumber)
    const base = tracked[0]?.openingBalance ?? 0
    const agendaValida = storedScheduleValid(tracked, base, loan.interestRateMonthly > 0, loan.rateType === 'POS')

    return NextResponse.json({
      loan: { contractNumber: loan.contractNumber, lender: loan.lender, rateType: loan.rateType },
      installment: { number: target.number, dueDate: target.dueDate, amortization: target.amortization, openingBalance: target.openingBalance, status: target.status, isEstimate: target.isEstimate },
      openInstallments: openList.map((i) => ({ number: i.number, dueDate: i.dueDate, status: i.status })),
      candidates: group.candidates.map((t) => ({ id: t.id, description: t.description, amount: t.amount, date: t.date, selected: t.selected })),
      paidTotal,
      split,
      saldoAntes: target.openingBalance,
      saldoDepois: split.closingBalance,
      agendaValida,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
