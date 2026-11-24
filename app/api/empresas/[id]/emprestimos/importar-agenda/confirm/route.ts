// Sprint Importar Agenda (04/08/2026) — FASE 2: grava a agenda oficial. Re-parseia
// o PDF (stateless), aplica cada contrato casado e NÃO bloqueado: update-in-place
// por número (preserva vínculos 1:1 e N:1), marca liquidadas como pagas com o split
// do DOCUMENTO, e marca o Loan como scheduleSource=IMPORTED. Tudo em $transaction.
// NUNCA muda valor/data/saldo de transação bancária.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { extractPdfText, PdfExtractError } from '@/lib/bank-statement-pdf/extract-pdf-text'
import { detectScheduleParser } from '@/lib/loans/bank-parsers'
import { applyImportedSchedule } from '@/lib/loans/apply-imported-schedule'
import { descriptionMatchesContract } from '@/lib/loans/contract-core'
import { hrefCadastrarNaHora, type ContratoDesconhecido } from '@/lib/loans/cadastro-na-hora'
import { CONTRATO_VISIVEL } from '@/lib/loans/ficha'

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

    const parser = detectScheduleParser(text)
    if (!parser) return NextResponse.json({ erro: 'Documento não reconhecido (layouts suportados: Sicredi, Caixa).', code: 'BANK_NOT_SUPPORTED' }, { status: 422 })
    let contracts
    try {
      contracts = parser.parse(text)
    } catch (err) {
      return NextResponse.json({ erro: err instanceof Error ? err.message : 'Documento inconsistente.', code: 'PARSE_INCONSISTENT' }, { status: 422 })
    }
    if (contracts.length === 0) return NextResponse.json({ erro: `Nenhum contrato reconhecido (${parser.bank}).`, code: 'NO_CONTRACTS' }, { status: 422 })

    const loans = await prisma.loan.findMany({
      where: { companyId: empresaId, ...CONTRATO_VISIVEL },
      select: {
        id: true, contractNumber: true, rateType: true, termMonths: true,
        installments: {
          orderBy: { number: 'asc' },
          select: {
            id: true, number: true, status: true, reconciledTransactionId: true, _count: { select: { payments: true } },
            // ⭐ N+1 (25/11) — os valores atuais, pra gravar SÓ a linha que mudou
            dueDate: true, openingBalance: true, interest: true, amortization: true, correcao: true, payment: true,
            closingBalance: true, isEstimate: true, paidTotal: true, paidInterest: true, paidCorrection: true, paidPenalty: true,
          },
        },
      },
    })

    const applied: Array<{ contractNumber: string; parcelasGravadas: number; saldo: number }> = []
    const skipped: Array<{ contractNumber: string; motivo: string }> = []
    // ⭐ R63 (25/11) — contrato do documento que não existe aqui: OFERTA de cadastro, nunca pulo calado
    const desconhecidos: Array<ContratoDesconhecido & { cadastrarHref: string }> = []

    for (const c of contracts) {
      if (onlyThese && !onlyThese.has(c.contractNumber)) continue
      const loan = loans.find((l) => l.contractNumber === c.contractNumber)
        ?? loans.find((l) => l.contractNumber && descriptionMatchesContract(c.contractNumber, l.contractNumber))
      if (!loan) {
        const d: ContratoDesconhecido = { contractNumber: c.contractNumber, banco: parser.bank, valorFinanciado: c.valorFinanciado, numParcelas: c.numParcelas }
        desconhecidos.push({ ...d, cadastrarHref: hrefCadastrarNaHora(empresaId, d) })
        continue
      }

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
            // termMonths = nº de parcelas AMORTIZANTES (derivado por data), NÃO o
            // prazo total. carência = meses de carência (prazoTotal − parcelas).
            ...(c.numParcelas > 0 && c.numParcelas !== loan.termMonths ? { termMonths: c.numParcelas } : {}),
            ...(c.carenciaMeses != null ? { carencia: c.carenciaMeses } : {}),
          },
        })
        /**
         * ⭐ N+1 curado (25/11/2026): antes era um `update`/`create` por parcela. Agora a linha
         * nova vai num `createMany` e a existente só é gravada se MUDOU — reimportar o mesmo
         * PDF não escreve nada.
         */
        const novas: Prisma.LoanInstallmentCreateManyInput[] = []
        for (const r of plan.rows) {
          const ex = byNumber.get(r.number)
          const data = {
            dueDate: new Date(r.dueDate), openingBalance: r.openingBalance, interest: r.interest,
            amortization: r.amortization, correcao: r.correcao, payment: r.payment, closingBalance: r.closingBalance,
            status: r.status, isEstimate: r.isEstimate,
            ...(r.status === 'PAID'
              ? { paidTotal: r.paidTotal, paidInterest: r.paidInterest, paidCorrection: 0, paidPenalty: 0 }
              : { paidTotal: null, paidInterest: null, paidCorrection: null, paidPenalty: null }),
          }
          if (!ex) { novas.push({ loanId: loan.id, number: r.number, ...data }); continue }
          const mudou = (Object.keys(data) as Array<keyof typeof data>).some((k) => {
            const a = data[k], b = (ex as Record<string, unknown>)[k]
            if (a instanceof Date) return !(b instanceof Date) || a.getTime() !== b.getTime()
            return (a ?? null) !== (b ?? null)
          })
          if (mudou) await trx.loanInstallment.update({ where: { id: ex.id }, data })
        }
        if (novas.length > 0) {
          await trx.loanInstallment.createMany({ data: novas })
        }
        const toDelete = loan.installments.filter((i) => !newNumbers.has(i.number) && !i.reconciledTransactionId && i._count.payments === 0)
        if (toDelete.length > 0) await trx.loanInstallment.deleteMany({ where: { id: { in: toDelete.map((i) => i.id) } } })
      })
      applied.push({ contractNumber: c.contractNumber, parcelasGravadas: plan.rows.length, saldo: plan.saldoDepois })
    }

    return NextResponse.json({ ok: true, applied, skipped, desconhecidos })
  } catch (error) {
    return handleApiError(error)
  }
}
