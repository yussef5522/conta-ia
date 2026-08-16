// Sprint Casar Pagamento (04/08/2026) — FASE 4: grava o vínculo N:1 parcela↔tx.
// UMA confirmação fecha o grupo, em $transaction. Cria LoanInstallmentPayment por
// lançamento e preenche o split na parcela. NUNCA muda valor/data/saldo de tx.
// Se a agenda armazenada não fecha, VINCULA mas NÃO grava o split (FASE 5.3) — o
// dinheiro saiu (fato), mas juros/principal ficam "a definir" até corrigir a agenda.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { computeLinkSplit, storedScheduleValid, shouldWriteSplit } from '@/lib/loans/link-payment'

export const runtime = 'nodejs'
interface Params { params: Promise<{ id: string; loanId: string }> }

const bodySchema = z.object({
  installmentNumber: z.number().int().positive(),
  transactionIds: z.array(z.string().min(1)).min(1).max(100),
  confirm: z.literal(true),
})

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId, loanId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.update')
    const body = bodySchema.parse(await request.json())

    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      select: { companyId: true, bankAccountId: true, interestRateMonthly: true, rateType: true, installmentsPaidBefore: true, scheduleSource: true },
    })
    if (!loan) return NextResponse.json({ erro: 'Empréstimo não encontrado' }, { status: 404 })
    if (loan.companyId !== empresaId) return NextResponse.json({ erro: 'Outra empresa' }, { status: 403 })

    const installments = await prisma.loanInstallment.findMany({
      where: { loanId }, orderBy: { number: 'asc' },
      select: { id: true, number: true, amortization: true, openingBalance: true, status: true },
    })
    const target = installments.find((i) => i.number === body.installmentNumber)
    if (!target) return NextResponse.json({ erro: 'Parcela não encontrada' }, { status: 404 })
    if (target.status === 'PAID') return NextResponse.json({ erro: 'Parcela já quitada' }, { status: 409 })

    // Multi-tenant + guards: tx da MESMA conta do empréstimo, DEBIT, EFFECTED,
    // não vinculadas a nenhuma parcela (1:1 nem N:1).
    const txs = await prisma.transaction.findMany({
      where: {
        id: { in: body.transactionIds }, bankAccountId: loan.bankAccountId, type: 'DEBIT', lifecycle: 'EFFECTED',
        loanInstallmentPaid: { is: null }, loanInstallmentPayments: { none: {} },
      },
      select: { id: true, amount: true, date: true },
    })
    if (txs.length !== body.transactionIds.length) {
      return NextResponse.json({ erro: 'Alguns lançamentos não são elegíveis (conta errada, já vinculados, ou não são débito).', code: 'TX_INELIGIBLE' }, { status: 409 })
    }

    const paidTotal = txs.reduce((s, t) => s + t.amount, 0)
    const split = computeLinkSplit({
      installment: { amortization: target.amortization, openingBalance: target.openingBalance },
      rateMonthly: loan.interestRateMonthly, paidTotal,
    })

    const startNumber = loan.installmentsPaidBefore + 1
    const trackedFull = await prisma.loanInstallment.findMany({
      where: { loanId, number: { gte: startNumber } }, orderBy: { number: 'asc' },
      select: { number: true, openingBalance: true, interest: true, amortization: true, correcao: true, payment: true, closingBalance: true },
    })
    const base = trackedFull[0]?.openingBalance ?? 0
    const agendaValida = storedScheduleValid(trackedFull, base, loan.interestRateMonthly > 0, loan.rateType === 'POS')

    const paidDate = txs.reduce((max, t) => (t.date > max ? t.date : max), txs[0].date)
    const status = split.isPartial ? 'PARTIAL' : 'PAID'

    // Empréstimo SEM JUROS (mútuo Arafat / FLEXIBLE): o split é determinístico
    // (encargo 0, amortização = valor devolvido inteiro). A agenda nominal de 7x
    // é irrelevante — SEMPRE grava o split e move a amortização pro valor pago,
    // pra o saldo (principal − Σamort PAID) cair exatamente o que foi devolvido.
    const isZeroRate = loan.interestRateMonthly === 0
    // FIX (15/08): IMPORTED confia no amort do banco → grava o split mesmo com
    // juros=0 nas OPEN. Ver shouldWriteSplit (dono único). Sem isso, POS casada
    // pela tela nasce com paidInterest=0 (bug da #2/#23).
    const gravaSplit = shouldWriteSplit({
      scheduleSource: loan.scheduleSource,
      isZeroRate,
      agendaValida,
      isPartial: split.isPartial,
    })

    await prisma.$transaction(async (trx) => {
      for (const t of txs) {
        await trx.loanInstallmentPayment.create({ data: { installmentId: target.id, transactionId: t.id, amount: t.amount } })
      }
      await trx.loanInstallment.update({
        where: { id: target.id },
        data: {
          status,
          paidDate,
          paidTotal: split.paidTotal,
          // Split só quando a agenda fecha (FASE 5.3). Senão fica "a definir".
          // Zero-rate sempre grava (encargo 0, sem risco de despesa espúria).
          ...(gravaSplit
            ? {
                paidInterest: split.paidInterest, paidCorrection: split.paidCorrection, paidPenalty: split.paidPenalty,
                closingBalance: split.closingBalance,
                // 0%: amortização = valor devolvido (não a parcela nominal).
                ...(isZeroRate ? { amortization: split.amortization } : {}),
              }
            : {}),
        },
      })
    })

    return NextResponse.json({
      ok: true, linked: txs.length, status, paidTotal: split.paidTotal,
      splitInjected: gravaSplit, isPartial: split.isPartial, agendaValida,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
