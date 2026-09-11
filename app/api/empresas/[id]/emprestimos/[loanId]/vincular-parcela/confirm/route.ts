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
import { vincularPagamentoDeParcela, VinculoDeParcelaError } from '@/lib/loans/vincular-pagamento'
import { exigeContaDoEmprestimo, MutuoSemContaError } from '@/lib/loans/exige-conta'

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
        id: { in: body.transactionIds }, bankAccountId: exigeContaDoEmprestimo(loan, 'vincular a parcela'), type: 'DEBIT', lifecycle: 'EFFECTED',
        loanInstallmentPaid: { is: null }, loanInstallmentPayments: { none: {} },
      },
      select: { id: true, amount: true, date: true },
    })
    if (txs.length !== body.transactionIds.length) {
      return NextResponse.json({ erro: 'Alguns lançamentos não são elegíveis (conta errada, já vinculados, ou não são débito).', code: 'TX_INELIGIBLE' }, { status: 409 })
    }

    // ⭐ A GRAVAÇÃO MORA NA LIB (11/09/2026) — a MESMA que o import chama. Antes ela
    // vivia só aqui, e o import gravava do jeito dele: marcava PAID **sem split**, o que
    // jogava os encargos pra fora do DRE. Uma porta, dois chamadores (REGRA 4).
    const r = await vincularPagamentoDeParcela({
      db: prisma, companyId: empresaId, loanId,
      installmentNumber: target.number, transactionIds: body.transactionIds,
    })
    return NextResponse.json({ ok: true, ...r })
  } catch (error) {
    if (error instanceof VinculoDeParcelaError) {
      return NextResponse.json({ erro: error.message, code: error.code }, { status: 409 })
    }
    return handleApiError(error)
  }
}
