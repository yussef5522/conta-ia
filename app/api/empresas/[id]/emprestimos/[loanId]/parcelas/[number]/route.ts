// POST   /api/empresas/[id]/emprestimos/[loanId]/parcelas/[number]
//        → confirma parcela como paga (manual, escolhe tx) OU sugere candidatos
// DELETE /api/empresas/[id]/emprestimos/[loanId]/parcelas/[number]
//        → desfaz pagamento (OPEN de novo, libera tx)
// GET    /api/empresas/[id]/emprestimos/[loanId]/parcelas/[number]/candidatos
//        → mostra debitos candidatos pra marcação manual

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
// Sprint Pagamento Parcela Redesign (28/06/2026) — split contábil pos-fixado.
import {
  computePosFixedSplit,
  computePreFixedSplit,
} from '@/lib/loans/installment-match'

interface Params {
  params: Promise<{ id: string; loanId: string; number: string }>
}

const confirmSchema = z.object({
  transactionId: z.string().cuid(),
})

// POST — marca parcela PAID + linka tx
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId, loanId, number: numberStr } = await params
    const number = parseInt(numberStr, 10)
    if (!Number.isInteger(number) || number < 1) {
      return NextResponse.json({ erro: 'number inválido' }, { status: 400 })
    }
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.update')

    const body = await request.json()
    const { transactionId } = confirmSchema.parse(body)

    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      select: {
        companyId: true,
        bankAccountId: true,
        interestRateMonthly: true,
      },
    })
    if (!loan) return NextResponse.json({ erro: 'Loan não encontrado' }, { status: 404 })
    if (loan.companyId !== empresaId) {
      return NextResponse.json({ erro: 'Outra empresa' }, { status: 403 })
    }

    const installment = await prisma.loanInstallment.findFirst({
      where: { loanId, number },
      select: {
        id: true,
        status: true,
        payment: true,
        interest: true,
        amortization: true,
        openingBalance: true,
        isEstimate: true,
        reconciledTransactionId: true,
      },
    })
    if (!installment) {
      return NextResponse.json({ erro: 'Parcela não encontrada' }, { status: 404 })
    }
    if (installment.status === 'PAID' && installment.reconciledTransactionId) {
      return NextResponse.json({ erro: 'Parcela já está paga' }, { status: 409 })
    }

    const tx = await prisma.transaction.findUnique({
      where: { id: transactionId },
      select: {
        id: true,
        type: true,
        bankAccountId: true,
        date: true,
        amount: true,
        loanInstallmentPaid: { select: { id: true } },
      },
    })
    if (!tx) return NextResponse.json({ erro: 'Tx não encontrada' }, { status: 404 })
    if (tx.bankAccountId !== loan.bankAccountId) {
      return NextResponse.json(
        { erro: 'Tx deve ser da mesma conta do empréstimo' },
        { status: 400 },
      )
    }
    if (tx.type !== 'DEBIT') {
      return NextResponse.json({ erro: 'Pagamento de parcela deve ser DEBIT' }, { status: 400 })
    }
    if (tx.loanInstallmentPaid && tx.loanInstallmentPaid.id !== installment.id) {
      return NextResponse.json(
        { erro: 'Tx já vinculada a outra parcela' },
        { status: 409 },
      )
    }

    // Sprint Pagamento Parcela Redesign (28/06/2026): recalcular split contábil.
    // Pré-fixado: usa valores planejados, correcao=0.
    // Pós-fixado (isEstimate=true): juros base = openingBalance × rateMonthly;
    //                                correcao = realPayment − amortização − juros;
    //                                payment = realPayment.
    // Espelha lib/loans/auto-conciliacao.ts pra ter UM caminho contábil.
    const split = installment.isEstimate
      ? computePosFixedSplit(
          {
            amortization: installment.amortization,
            openingBalance: installment.openingBalance,
          },
          tx.amount,
          loan.interestRateMonthly,
        )
      : computePreFixedSplit({
          interest: installment.interest,
          amortization: installment.amortization,
          payment: installment.payment,
          openingBalance: installment.openingBalance,
        })

    await prisma.$transaction(async (trx) => {
      await trx.loanInstallment.update({
        where: { id: installment.id },
        data: {
          status: 'PAID',
          paidDate: tx.date,
          reconciledTransactionId: tx.id,
          // Recalculado pelo split (idêntico ao auto-conciliação)
          realPayment: split.realPayment,
          payment: split.realPayment,
          interest: split.interest,
          correcao: split.correcao,
          closingBalance: split.closingBalance,
        },
      })
      // Se todas as parcelas estão PAID → marca Loan PAID_OFF
      const remaining = await trx.loanInstallment.count({
        where: { loanId, status: { not: 'PAID' } },
      })
      if (remaining === 0) {
        await trx.loan.update({ where: { id: loanId }, data: { status: 'PAID_OFF' } })
      }
    })

    return NextResponse.json({
      ok: true,
      split: {
        realPayment: split.realPayment,
        interest: split.interest,
        correcao: split.correcao,
        closingBalance: split.closingBalance,
        totalDespesaFinanceira: split.totalDespesaFinanceira,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE — desfaz pagamento
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId, loanId, number: numberStr } = await params
    const number = parseInt(numberStr, 10)
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.update')

    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      select: { companyId: true, status: true },
    })
    if (!loan) return NextResponse.json({ erro: 'Não encontrado' }, { status: 404 })
    if (loan.companyId !== empresaId) {
      return NextResponse.json({ erro: 'Outra empresa' }, { status: 403 })
    }

    const installment = await prisma.loanInstallment.findFirst({
      where: { loanId, number },
      select: { id: true },
    })
    if (!installment) return NextResponse.json({ erro: 'Parcela não encontrada' }, { status: 404 })

    await prisma.$transaction(async (trx) => {
      await trx.loanInstallment.update({
        where: { id: installment.id },
        data: { status: 'OPEN', paidDate: null, reconciledTransactionId: null },
      })
      if (loan.status === 'PAID_OFF') {
        await trx.loan.update({ where: { id: loanId }, data: { status: 'ACTIVE' } })
      }
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
