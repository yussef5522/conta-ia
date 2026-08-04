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
import { computePosFixedSplit, computePreFixedSplit } from '@/lib/loans/installment-match'

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
        correcao: true, payment: true, closingBalance: true, status: true, isEstimate: true, paidDate: true,
        reconciledTransactionId: true, realPayment: true,
        reconciledTransaction: { select: { amount: true } },
      },
    })
    const installmentsForRegen = installments.map((i) => ({ ...i, reconciledTxAmount: i.reconciledTransaction?.amount ?? null }))

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

      for (const nr of result.rows) {
        const ex = byNumber.get(nr.number)
        if (ex && ex.reconciledTransactionId) {
          // Preserva o vínculo; recomputa o split com o valor REAL debitado (amount
          // da tx reconciliada quando realPayment é null) sobre a amort nova.
          const realPayment = ex.realPayment ?? ex.reconciledTransaction?.amount ?? ex.payment
          const split = body.isPostFixed
            ? computePosFixedSplit({ amortization: nr.amortization, openingBalance: nr.openingBalance }, realPayment, body.rateMonthly)
            : computePreFixedSplit({ interest: nr.interest, amortization: nr.amortization, payment: nr.payment, openingBalance: nr.openingBalance })
          await trx.loanInstallment.update({
            where: { id: ex.id },
            data: {
              dueDate: nr.dueDate, openingBalance: nr.openingBalance, amortization: nr.amortization,
              interest: split.interest, correcao: split.correcao, payment: split.realPayment,
              // Persiste o valor REAL pra próximos recálculos não caírem no fallback.
              realPayment: split.realPayment,
              closingBalance: split.closingBalance, isEstimate: false,
              // status/paidDate/reconciledTransactionId INTOCADOS (vínculo preservado).
            },
          })
        } else if (ex) {
          await trx.loanInstallment.update({
            where: { id: ex.id },
            data: {
              dueDate: nr.dueDate, openingBalance: nr.openingBalance, interest: nr.interest,
              amortization: nr.amortization, correcao: nr.correcao, payment: nr.payment,
              closingBalance: nr.closingBalance, isEstimate: nr.isEstimate,
            },
          })
        } else {
          await trx.loanInstallment.create({
            data: {
              loanId, number: nr.number, dueDate: nr.dueDate, openingBalance: nr.openingBalance,
              interest: nr.interest, amortization: nr.amortization, correcao: nr.correcao,
              payment: nr.payment, closingBalance: nr.closingBalance, isEstimate: nr.isEstimate, status: 'OPEN',
            },
          })
        }
      }

      // Parcelas rastreadas que sumiram do novo cronograma (não reconciliadas —
      // reconciliadas já teriam bloqueado acima): remove.
      const toDelete = installments.filter((i) => i.number >= startNumber && !newNumbers.has(i.number) && !i.reconciledTransactionId)
      if (toDelete.length > 0) {
        await trx.loanInstallment.deleteMany({ where: { id: { in: toDelete.map((i) => i.id) } } })
      }
    })

    return NextResponse.json({ ok: true, parcelasGravadas: result.rows.length, reconciliacoesPreservadas: result.reconciled.length })
  } catch (error) {
    return handleApiError(error)
  }
}
