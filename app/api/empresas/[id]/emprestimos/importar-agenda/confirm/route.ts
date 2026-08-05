// Sprint Importar Agenda (04/08/2026) — FASE 2: grava a agenda oficial. Re-parseia
// o PDF (stateless), aplica cada contrato casado e NÃO bloqueado: update-in-place
// por número (preserva vínculos 1:1 e N:1), marca liquidadas como pagas com o split
// do DOCUMENTO, e marca o Loan como scheduleSource=IMPORTED. Tudo em $transaction.
// NUNCA muda valor/data/saldo de transação bancária.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { extractPdfText, PdfExtractError } from '@/lib/bank-statement-pdf/extract-pdf-text'
import { sicrediScheduleParser } from '@/lib/loans/sicredi-schedule-parser'
import { applyImportedSchedule } from '@/lib/loans/apply-imported-schedule'
import { descriptionMatchesContract } from '@/lib/loans/contract-core'

export const runtime = 'nodejs'
export const maxDuration = 60
interface Params { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.update')

    const form = await request.formData().catch(() => null)
    const file = form?.get('file')
    const confirmContracts = form?.get('contracts') // opcional: subset a aplicar
    if (!file || typeof file === 'string') return NextResponse.json({ erro: 'PDF não enviado' }, { status: 400 })
    const onlyThese = typeof confirmContracts === 'string' && confirmContracts.length > 0 ? new Set(confirmContracts.split(',')) : null

    let text: string
    try {
      text = await extractPdfText(new Uint8Array(await (file as File).arrayBuffer()))
    } catch (err) {
      if (err instanceof PdfExtractError) return NextResponse.json({ erro: err.message, code: err.code }, { status: 400 })
      return NextResponse.json({ erro: 'Não foi possível ler o PDF.' }, { status: 500 })
    }

    const contracts = sicrediScheduleParser.parse(text)
    if (contracts.length === 0) return NextResponse.json({ erro: 'Nenhum contrato reconhecido.', code: 'NO_CONTRACTS' }, { status: 422 })

    const loans = await prisma.loan.findMany({
      where: { companyId: empresaId },
      select: {
        id: true, contractNumber: true, rateType: true, termMonths: true,
        installments: { orderBy: { number: 'asc' }, select: { id: true, number: true, status: true, reconciledTransactionId: true, paidInterest: true, _count: { select: { payments: true } } } },
      },
    })

    const applied: Array<{ contractNumber: string; parcelasGravadas: number; saldo: number }> = []
    const skipped: Array<{ contractNumber: string; motivo: string }> = []

    for (const c of contracts) {
      if (onlyThese && !onlyThese.has(c.contractNumber)) continue
      const loan = loans.find((l) => l.contractNumber === c.contractNumber)
        ?? loans.find((l) => l.contractNumber && descriptionMatchesContract(c.contractNumber, l.contractNumber))
      if (!loan) { skipped.push({ contractNumber: c.contractNumber, motivo: 'não cadastrado' }); continue }

      const plan = applyImportedSchedule(
        c,
        { contractNumber: loan.contractNumber, rateType: loan.rateType },
        // competenceMonth/currentEncargo não são usados na GRAVAÇÃO (só no preview
        // pro cálculo do impacto no DRE) — o write depende só de rows + blocked.
        loan.installments.map((i) => ({ number: i.number, status: i.status, reconciledTransactionId: i.reconciledTransactionId, hasNPayments: i._count.payments > 0, paidInterest: i.paidInterest, competenceMonth: null, currentEncargo: 0 })),
      )
      if (plan.blocked) { skipped.push({ contractNumber: c.contractNumber, motivo: plan.blockReason ?? 'bloqueado' }); continue }

      const byNumber = new Map(loan.installments.map((i) => [i.number, i]))
      const newNumbers = new Set(plan.rows.map((r) => r.number))

      await prisma.$transaction(async (trx) => {
        await trx.loan.update({
          where: { id: loan.id },
          data: {
            scheduleSource: 'IMPORTED',
            financedAmount: c.valorFinanciado,
            ...(c.numParcelas > 0 && c.numParcelas !== loan.termMonths ? { termMonths: c.numParcelas } : {}),
          },
        })
        for (const r of plan.rows) {
          const ex = byNumber.get(r.number)
          const data = {
            dueDate: new Date(r.dueDate), openingBalance: r.openingBalance, interest: r.interest,
            amortization: r.amortization, correcao: r.correcao, payment: r.payment, closingBalance: r.closingBalance,
            status: r.status, isEstimate: r.isEstimate,
            // Split do DOCUMENTO nas liquidadas (verbatim). Vínculos preservados.
            ...(r.status === 'PAID'
              ? { paidTotal: r.paidTotal, paidInterest: r.paidInterest, paidCorrection: 0, paidPenalty: 0 }
              : { paidTotal: null, paidInterest: null, paidCorrection: null, paidPenalty: null }),
          }
          if (ex) await trx.loanInstallment.update({ where: { id: ex.id }, data })
          else await trx.loanInstallment.create({ data: { loanId: loan.id, number: r.number, ...data } })
        }
        // Números que sumiram (não vinculados — vinculados já bloqueariam).
        const toDelete = loan.installments.filter((i) => !newNumbers.has(i.number) && !i.reconciledTransactionId && i._count.payments === 0)
        if (toDelete.length > 0) await trx.loanInstallment.deleteMany({ where: { id: { in: toDelete.map((i) => i.id) } } })
      })
      applied.push({ contractNumber: c.contractNumber, parcelasGravadas: plan.rows.length, saldo: plan.saldoDepois })
    }

    return NextResponse.json({ ok: true, applied, skipped })
  } catch (error) {
    return handleApiError(error)
  }
}
