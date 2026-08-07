// Sprint Importar Agenda (04/08/2026) — FASE 2: preview da importação da agenda
// oficial. Upload do PDF → extrai texto (poppler, guards LGPD) → parseia (Sicredi)
// → casa cada contrato com Loan → monta antes/depois. READ-ONLY, nada grava.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { extractPdfText, PdfExtractError } from '@/lib/bank-statement-pdf/extract-pdf-text'
import { detectScheduleParser } from '@/lib/loans/bank-parsers'
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

    const parser = detectScheduleParser(text)
    if (!parser) {
      return NextResponse.json({ erro: 'Documento não reconhecido. Layouts suportados hoje: Sicredi e Caixa (Demonstrativo de Evolução Contratual). Se for outro banco, ainda não é suportado.', code: 'BANK_NOT_SUPPORTED' }, { status: 422 })
    }
    let contracts
    try {
      contracts = parser.parse(text)
    } catch (err) {
      // parser aborta em leitura inconsistente (ex: resíduo negativo) — nunca grava.
      return NextResponse.json({ erro: err instanceof Error ? err.message : 'Documento inconsistente.', code: 'PARSE_INCONSISTENT' }, { status: 422 })
    }
    if (contracts.length === 0) {
      return NextResponse.json({ erro: `Nenhum contrato reconhecido no documento (${parser.bank}).`, code: 'NO_CONTRACTS' }, { status: 422 })
    }

    const loans = await prisma.loan.findMany({
      where: { companyId: empresaId },
      select: {
        id: true, contractNumber: true, lender: true, principal: true, rateType: true,
        installmentsPaidBefore: true, interestRateMonthly: true, scheduleSource: true,
        termMonths: true, carencia: true,
        installments: {
          orderBy: { number: 'asc' },
          select: {
            number: true, status: true, reconciledTransactionId: true, paidInterest: true, paidCorrection: true, paidDate: true,
            openingBalance: true, interest: true, amortization: true, correcao: true, payment: true, closingBalance: true,
            reconciledTransaction: { select: { date: true } },
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
        loan.installments.map((i) => {
          const is11 = i.reconciledTransactionId != null
          const isN1 = i._count.payments > 0
          // competência que o DRE usa: 1:1 = data da tx; N:1 = paidDate
          const compDate = is11 ? i.reconciledTransaction?.date : i.paidDate
          return {
            number: i.number, status: i.status, reconciledTransactionId: i.reconciledTransactionId,
            hasNPayments: isN1, paidInterest: i.paidInterest,
            competenceMonth: (is11 || isN1) && compDate ? compDate.toISOString().slice(0, 7) : null,
            currentEncargo: is11 ? (i.interest || 0) + (i.correcao || 0) : isN1 ? (i.paidInterest || 0) + (i.paidCorrection || 0) : 0,
          }
        }),
      )
      const saldoAntes = saldoDevedorAtual(
        { principal: loan.principal, installmentsPaidBefore: loan.installmentsPaidBefore, interestRateMonthly: loan.interestRateMonthly, rateType: loan.rateType, scheduleSource: loan.scheduleSource },
        loan.installments,
      )
      const pagasAntes = loan.installments.filter((i) => i.status === 'PAID').length
      // Resíduo de mora (2º encargo não-listado) — mostrar honesto no preview.
      const residuoTotal = Math.round(
        c.installments.reduce((s, i) => s + (i.residuo ?? 0), 0) * 100,
      ) / 100
      return {
        contractNumber: c.contractNumber, matched: true, loanId: loan.id, lender: loan.lender,
        numParcelas: c.numParcelas, valorFinanciado: c.valorFinanciado,
        saldoAntes, saldoDepois: plan.saldoDepois, pagasAntes, pagasDepois: plan.pagasDepois,
        dreImpactByMonth: plan.dreImpactByMonth, dreImpactTotalDepois: plan.dreImpactTotalDepois, dreImpactTotalAntes: plan.dreImpactTotalAntes,
        historicoSemVinculoCount: plan.historicoSemVinculoCount, historicoEncargos: plan.historicoEncargos,
        blocked: plan.blocked, blockReason: plan.blockReason,
        // ── informativos lidos do documento (Caixa) ──
        sistemaAmortizacao: c.sistemaAmortizacao ?? null,
        taxaJurosMensal: c.taxaJurosMensal ?? null,
        indexador: c.indexador ?? null,
        carencia: c.carencia ?? null,
        residuoMoraTotal: residuoTotal,
        // prazo/carência ANTES→DEPOIS (o usuário paga numParcelas, não o prazo total)
        parcelasAntes: loan.termMonths,
        parcelasDepois: c.numParcelas,
        carenciaAntes: loan.carencia,
        carenciaDepois: c.carenciaMeses ?? null,
        prazoTotalMeses: c.prazoTotalMeses ?? null,
      }
    })

    // Agregados HONESTOS: impacto no DRE (só vinculadas) por competência + o
    // histórico reconstruído (sem efeito no resultado).
    const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
    const dreByMonth: Record<string, number> = {}
    let dreTotal = 0, historicoCount = 0, historicoTotal = 0
    for (const r of result) {
      if (!r.matched) continue
      for (const m of r.dreImpactByMonth!) { dreByMonth[m.month] = r2((dreByMonth[m.month] ?? 0) + m.depois); dreTotal = r2(dreTotal + m.depois) }
      historicoCount += r.historicoSemVinculoCount!
      historicoTotal = r2(historicoTotal + r.historicoEncargos!)
    }
    const dreDistribuicao = Object.entries(dreByMonth).sort(([a], [b]) => a.localeCompare(b)).map(([month, encargos]) => ({ month, encargos }))
    return NextResponse.json({
      bank: parser.bank,
      contracts: result,
      impactoDRE: { total: dreTotal, porCompetencia: dreDistribuicao },
      historicoReconstruido: { parcelas: historicoCount, encargos: historicoTotal },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
