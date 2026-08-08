// FASE 3 (08/08) — PREVIEW read-only da importação da agenda Banrisul. Replica a
// lógica da rota preview usando o .txt (fixture) direto, contra os Loans REAIS do
// prod. NÃO grava nada. Uso: DATABASE_URL=<prod> npx tsx scripts/banrisul-preview.ts

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { banrisulScheduleParser } from '../lib/loans/banrisul-schedule-parser'
import { applyImportedSchedule } from '../lib/loans/apply-imported-schedule'
import { saldoDevedorAtual } from '../lib/loans/saldo'

const prisma = new PrismaClient()
const CO = 'cmq17yapb00gnrndlh33sctbo'
const FIX = ['bnr_64956967.txt', 'bnr_57538834.txt']

async function main() {
  for (const f of FIX) {
    const text = readFileSync(join(__dirname, '..', 'lib/loans/__tests__/fixtures', f), 'utf-8')
    const [c] = banrisulScheduleParser.parse(text)
    const loan = await prisma.loan.findFirst({
      where: { companyId: CO, contractNumber: c.contractNumber },
      select: {
        id: true, contractNumber: true, lender: true, principal: true, rateType: true,
        installmentsPaidBefore: true, interestRateMonthly: true, scheduleSource: true, termMonths: true, carencia: true,
        installments: {
          orderBy: { number: 'asc' },
          select: {
            number: true, status: true, reconciledTransactionId: true, paidInterest: true, paidCorrection: true, paidDate: true,
            interest: true, correcao: true,
            reconciledTransaction: { select: { date: true } },
            _count: { select: { payments: true } },
          },
        },
      },
    })
    console.log(`\n════════ ${c.contractNumber} (${c.sistemaAmortizacao}${c.indexador ? '/' + c.indexador : ''}) ════════`)
    if (!loan) { console.log('  Loan NÃO encontrado — cadastrar primeiro'); continue }

    const plan = applyImportedSchedule(
      c, { contractNumber: loan.contractNumber, rateType: loan.rateType },
      loan.installments.map((i) => {
        const is11 = i.reconciledTransactionId != null
        const isN1 = i._count.payments > 0
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
      loan.installments as any,
    )
    const pagasAntes = loan.installments.filter((i) => i.status === 'PAID').length
    console.log(`  scheduleSource atual: ${loan.scheduleSource || '(vazio — split por fórmula)'}  rateType: ${loan.rateType}`)
    console.log(`  saldo:   ${saldoAntes} → ${plan.saldoDepois}`)
    console.log(`  pagas:   ${pagasAntes} → ${plan.pagasDepois}   parcelas: ${loan.termMonths} → ${c.numParcelas}   carência: ${loan.carencia} → ${c.carenciaMeses}`)
    console.log(`  financiado: ${c.valorFinanciado}`)
    console.log(`  BLOQUEADO: ${plan.blocked ? 'SIM — ' + plan.blockReason : 'não (nenhum vínculo se perde)'}`)
    console.log(`  IMPACTO NO DRE (só parcelas VINCULADAS): antes ${plan.dreImpactTotalAntes} → depois ${plan.dreImpactTotalDepois}`)
    for (const m of plan.dreImpactByMonth) console.log(`      ${m.month}: ${m.antes} → ${m.depois} (${m.parcelas} parc)`)
    console.log(`  RECONSTRUÇÃO DE HISTÓRICO (sem vínculo, FORA do DRE): ${plan.historicoSemVinculoCount} parcelas, encargos ${plan.historicoEncargos}`)
  }
  process.exit(0)
}
main().finally(() => prisma.$disconnect())
