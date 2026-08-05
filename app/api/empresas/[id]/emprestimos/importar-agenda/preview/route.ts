// Sprint Importar Agenda (04/08/2026) — FASE 2: preview da importação da agenda
// oficial. Upload do PDF → extrai texto (poppler, guards LGPD) → parseia (Sicredi)
// → casa cada contrato com Loan → monta antes/depois. READ-ONLY, nada grava.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { extractPdfText, PdfExtractError } from '@/lib/bank-statement-pdf/extract-pdf-text'
import { sicrediScheduleParser } from '@/lib/loans/sicredi-schedule-parser'
import { applyImportedSchedule } from '@/lib/loans/apply-imported-schedule'
import { descriptionMatchesContract } from '@/lib/loans/contract-core'
import { saldoDevedorAtual } from '@/lib/loans/saldo'

export const runtime = 'nodejs'
export const maxDuration = 60
interface Params { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.update')

    let pdfBytes: Uint8Array
    try {
      const form = await request.formData()
      const file = form.get('file')
      if (!file || typeof file === 'string') return NextResponse.json({ erro: 'PDF não enviado' }, { status: 400 })
      pdfBytes = new Uint8Array(await (file as File).arrayBuffer())
    } catch {
      return NextResponse.json({ erro: 'Erro ao ler o arquivo enviado' }, { status: 400 })
    }

    let text: string
    try {
      text = await extractPdfText(pdfBytes)
    } catch (err) {
      if (err instanceof PdfExtractError) {
        const status = err.code === 'FILE_TOO_LARGE' || err.code === 'NOT_A_PDF' || err.code === 'NO_TEXT_LAYER' ? 400 : 500
        return NextResponse.json({ erro: err.message, code: err.code }, { status })
      }
      return NextResponse.json({ erro: 'Não foi possível ler o PDF.' }, { status: 500 })
    }

    const contracts = sicrediScheduleParser.parse(text)
    if (contracts.length === 0) {
      return NextResponse.json({ erro: 'Nenhum contrato reconhecido no documento (layout Sicredi esperado).', code: 'NO_CONTRACTS' }, { status: 422 })
    }

    const loans = await prisma.loan.findMany({
      where: { companyId: empresaId },
      select: {
        id: true, contractNumber: true, lender: true, principal: true, rateType: true,
        installmentsPaidBefore: true, interestRateMonthly: true, scheduleSource: true,
        installments: {
          orderBy: { number: 'asc' },
          select: {
            number: true, status: true, reconciledTransactionId: true, paidInterest: true,
            openingBalance: true, interest: true, amortization: true, correcao: true, payment: true, closingBalance: true,
            _count: { select: { payments: true } },
          },
        },
      },
    })

    const result = contracts.map((c) => {
      const loan = loans.find((l) => l.contractNumber === c.contractNumber)
        ?? loans.find((l) => l.contractNumber && descriptionMatchesContract(c.contractNumber, l.contractNumber))
      if (!loan) {
        return { contractNumber: c.contractNumber, matched: false, numParcelas: c.numParcelas, valorFinanciado: c.valorFinanciado, saldoDevedor: c.saldoDevedor }
      }
      const plan = applyImportedSchedule(
        c,
        { contractNumber: loan.contractNumber, rateType: loan.rateType },
        loan.installments.map((i) => ({ number: i.number, status: i.status, reconciledTransactionId: i.reconciledTransactionId, hasNPayments: i._count.payments > 0, paidInterest: i.paidInterest })),
      )
      const saldoAntes = saldoDevedorAtual(
        { principal: loan.principal, installmentsPaidBefore: loan.installmentsPaidBefore, interestRateMonthly: loan.interestRateMonthly, rateType: loan.rateType, scheduleSource: loan.scheduleSource },
        loan.installments,
      )
      const pagasAntes = loan.installments.filter((i) => i.status === 'PAID').length
      return {
        contractNumber: c.contractNumber, matched: true, loanId: loan.id, lender: loan.lender,
        numParcelas: c.numParcelas, valorFinanciado: c.valorFinanciado,
        saldoAntes, saldoDepois: plan.saldoDepois, pagasAntes, pagasDepois: plan.pagasDepois,
        novoSplitDRE: plan.novoSplitDRE, blocked: plan.blocked, blockReason: plan.blockReason,
      }
    })

    const totalNovoEncargoDRE = result.reduce((s, r) => s + (r.matched ? r.novoSplitDRE!.reduce((a, x) => a + x.encargos, 0) : 0), 0)
    return NextResponse.json({ contracts: result, totalNovoEncargoDRE: Math.round(totalNovoEncargoDRE * 100) / 100 })
  } catch (error) {
    return handleApiError(error)
  }
}
