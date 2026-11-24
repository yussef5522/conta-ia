// Sprint Empréstimo Débito Parcial (03/08/2026) — PASSO 4: grava a correção da
// agenda. SÓ grava se: validação OK + não bloqueado + confirm explícito.
// Update-in-place por `number` (não deleta a linha que segura o vínculo @unique).
// Parcelas RECONCILIADAS mantêm status/paidDate/reconciledTransactionId e têm o
// split RECOMPUTADO com o valor REAL debitado sobre a amortização nova (passo 5).
// NUNCA muda amount/data/saldo de transação. Tudo em $transaction.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { regenerateSchedule } from '@/lib/loans/regenerate'
import { computeLinkSplit } from '@/lib/loans/link-payment'

export const runtime = 'nodejs'
interface Params { params: Promise<{ id: string; loanId: string }> }

const bodySchema = z.object({
  system: z.enum(['SAC', 'PRICE']),
  rateMonthly: z.number().min(0).max(1),
  isPostFixed: z.boolean(),
  parcela: z.number().positive().optional(),
  financedAmount: z.number().positive().optional(),
  graceMonths: z.number().int().min(0).max(60).optional(),
  graceType: z.enum(['JUROS', 'JUROS_CAPITALIZADOS']).optional(),
  confirm: z.literal(true),
}).refine((d) => d.system === 'PRICE' ? !!d.parcela : !!d.financedAmount, {
  message: 'PRICE exige parcela; SAC exige valor financiado',
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
        financedAmount: true, firstDueDate: true,
      },
    })
    if (!loan) return NextResponse.json({ erro: 'Empréstimo não encontrado' }, { status: 404 })
    if (loan.companyId !== empresaId) return NextResponse.json({ erro: 'Outra empresa' }, { status: 403 })

    const installments = await prisma.loanInstallment.findMany({
      where: { loanId },
      orderBy: { number: 'asc' },
      select: {
        id: true, number: true, dueDate: true, openingBalance: true, interest: true, amortization: true,
        correcao: true, payment: true, closingBalance: true, status: true, isEstimate: true, paidDate: true, paidTotal: true,
        reconciledTransactionId: true, realPayment: true, paidInterest: true, paidCorrection: true,
        reconciledTransaction: { select: { amount: true } },
        payments: { select: { amount: true } },
      },
    })
    const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
    const installmentsForRegen = installments.map((i) => {
      const linked = i.payments.length > 0 ? r2(i.payments.reduce((s, p) => s + p.amount, 0)) : null
      return {
        ...i, reconciledTxAmount: i.reconciledTransaction?.amount ?? null,
        linkedPaidTotal: linked,
        linkedEncargosBefore: linked != null ? r2((i.paidInterest ?? 0) + (i.paidCorrection ?? 0)) : null,
      }
    })

    const result = regenerateSchedule(
      {
        principal: loan.principal, outstandingBalanceInitial: loan.outstandingBalanceInitial,
        termMonths: loan.termMonths, installmentsPaidBefore: loan.installmentsPaidBefore,
        amortizationSystem: loan.amortizationSystem as 'PRICE' | 'SAC',
        amortizationConstant: loan.amortizationConstant, financedAmount: loan.financedAmount,
        firstDueDate: loan.firstDueDate,
      },
      installmentsForRegen,
      { system: body.system, rateMonthly: body.rateMonthly, isPostFixed: body.isPostFixed, parcela: body.parcela, financedAmount: body.financedAmount },
    )

    // Gate duplo: nada grava se a agenda não fecha ou se perde reconciliação.
    if (!result.validation.ok) {
      return NextResponse.json({ erro: 'A agenda não fecha — não gravei.', code: 'SCHEDULE_INVALID', detalhes: result.validation.errors }, { status: 422 })
    }
    if (result.blocked) {
      return NextResponse.json({ erro: result.blockReason, code: 'RECONCILIATION_AT_RISK' }, { status: 409 })
    }

    const startNumber = loan.installmentsPaidBefore + 1
    const byNumber = new Map(installments.map((i) => [i.number, i]))
    // FIX 2: parcelas com vínculo N:1 → Σ pagamentos reais, pra recomputar o split.
    const linkedByNumber = new Map(installmentsForRegen.filter((i) => i.linkedPaidTotal != null).map((i) => [i.number, i.linkedPaidTotal!]))
    const newNumbers = new Set(result.rows.map((r) => r.number))

    await prisma.$transaction(async (trx) => {
      // Cadastro passa a refletir o carnê real.
      await trx.loan.update({
        where: { id: loanId },
        data: {
          interestRateMonthly: body.rateMonthly,
          rateType: body.isPostFixed ? 'POS' : 'PRE',
          amortizationSystem: body.system,
          ...(body.financedAmount !== undefined ? { financedAmount: body.financedAmount } : {}),
          ...(body.system === 'SAC' && body.financedAmount !== undefined
            ? { amortizationConstant: Math.floor((body.financedAmount / loan.termMonths) * 100) / 100 }
            : {}),
          ...(body.graceMonths !== undefined ? { carencia: body.graceMonths } : {}),
          ...(body.graceType !== undefined ? { graceType: body.graceType } : {}),
        },
      })

      /**
       * ⭐⭐ R55 + N+1 (25/11/2026). Corrigir a agenda É escrever a agenda (gesto do dono) — mas:
       *  - a parcela PAGA recebe a linha NOVA da agenda e o pago é RE-APURADO em `paid*` pela
       *    mesma função da porta (`computeLinkSplit`); antes o pago era escrito POR CIMA da
       *    agenda (`payment = paidTotal`, `interest = paidInterest`) e o parcial virava `PARTIAL`;
       *  - a parcela SEM vínculo não tem quem aponte pra ela: sai e volta numa escrita só
       *    (deleteMany + createMany), em vez de um `update` por linha.
       */
      const linkedTotal = (ex: (typeof installments)[number]) =>
        linkedByNumber.get(ex.number) ?? (ex.reconciledTransactionId ? ex.reconciledTransaction?.amount ?? ex.payment : null)
      // ⛔ só sai-e-volta a parcela ABERTA sem pago nenhum — PAID sem vínculo (pago por documento,
      // ex. C41022227 #22) mantém a linha e o status; só a agenda dela é corrigida
      const intocavel = (ex: (typeof installments)[number]) => ex.status === 'PAID' || ex.paidTotal != null
      const semVinculo: typeof result.rows = []
      for (const nr of result.rows) {
        const ex = byNumber.get(nr.number)
        const pago = ex ? linkedTotal(ex) : null
        if (ex && pago == null && intocavel(ex)) {
          await trx.loanInstallment.update({
            where: { id: ex.id },
            data: {
              dueDate: nr.dueDate, openingBalance: nr.openingBalance, interest: nr.interest,
              amortization: nr.amortization, correcao: nr.correcao, payment: nr.payment,
              closingBalance: nr.closingBalance, isEstimate: nr.isEstimate,
            },
          })
          continue
        }
        if (!ex || pago == null) { semVinculo.push(nr); continue }
        const split = computeLinkSplit({ installment: { amortization: nr.amortization, openingBalance: nr.openingBalance }, rateMonthly: body.rateMonthly, paidTotal: pago })
        await trx.loanInstallment.update({
          where: { id: ex.id },
          data: {
            dueDate: nr.dueDate, openingBalance: nr.openingBalance, interest: nr.interest,
            amortization: nr.amortization, correcao: nr.correcao, payment: nr.payment,
            closingBalance: nr.closingBalance, isEstimate: nr.isEstimate,
            paidTotal: split.paidTotal, paidInterest: split.paidInterest, paidCorrection: split.paidCorrection, paidPenalty: split.paidPenalty,
            status: split.isPartial ? 'OPEN' : 'PAID',
          },
        })
      }
      const numerosSemVinculo = new Set(semVinculo.map((r) => r.number))
      const saem = installments.filter((i) =>
        i.number >= startNumber && linkedTotal(i) == null && !intocavel(i)
        && (numerosSemVinculo.has(i.number) || !newNumbers.has(i.number)))
      if (saem.length > 0) {
        await trx.loanInstallment.deleteMany({ where: { id: { in: saem.map((i) => i.id) } } })
      }
      if (semVinculo.length > 0) {
        await trx.loanInstallment.createMany({
          data: semVinculo.map((nr) => ({
            loanId, number: nr.number, dueDate: nr.dueDate, openingBalance: nr.openingBalance,
            interest: nr.interest, amortization: nr.amortization, correcao: nr.correcao,
            payment: nr.payment, closingBalance: nr.closingBalance, isEstimate: nr.isEstimate, status: 'OPEN',
          })),
        })
      }
    })

    return NextResponse.json({ ok: true, parcelasGravadas: result.rows.length, reconciliacoesPreservadas: result.reconciled.length })
  } catch (error) {
    return handleApiError(error)
  }
}
