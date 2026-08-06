import { describe, it, expect } from 'vitest'
import { saldoDevedorAtual, type SaldoInstallment } from '../saldo'
import { generateSchedule } from '../amortization'

// agenda SAC válida de 100.000 em 10 parcelas (amort 10.000)
function validSchedule(): SaldoInstallment[] {
  const rows = generateSchedule({ principal: 100000, rateMonthly: 0.01, termMonths: 10, system: 'SAC', firstDueDate: new Date('2026-01-15') })
  return rows.map((r) => ({ number: r.number, status: 'OPEN', openingBalance: r.openingBalance, interest: r.interest, amortization: r.amortization, correcao: 0, payment: r.payment, closingBalance: r.closingBalance }))
}

describe('saldoDevedorAtual', () => {
  const loan = { principal: 100000, installmentsPaidBefore: 0, interestRateMonthly: 0.01, rateType: 'PRE' as const }

  it('agenda válida + 2 pagas → closingBalance da última paga (não principal−Σ)', () => {
    const insts = validSchedule()
    insts[0].status = 'PAID' // #1 closing 90.000
    insts[1].status = 'PAID' // #2 closing 80.000
    expect(saldoDevedorAtual(loan, insts)).toBeCloseTo(80000, 2)
  })

  it('nenhuma paga → abertura da 1ª parcela (1.3)', () => {
    expect(saldoDevedorAtual(loan, validSchedule())).toBeCloseTo(100000, 2)
  })

  it('C41022570: 12 pagas, agenda corrigida → 100.000,08 (não 95.833,40)', () => {
    // faixa rastreada #11-#36, SAC amort 4.166,66, #11 abre 108.333,40
    const rows: SaldoInstallment[] = []
    // phantoms #1-#10 (histórico, opening 0)
    for (let n = 1; n <= 10; n++) rows.push({ number: n, status: 'PAID', openingBalance: 0, interest: 0, amortization: 0, correcao: 0, payment: 0, closingBalance: 0 })
    // tracked #11-#36
    let saldo = 108333.4
    for (let n = 11; n <= 36; n++) {
      const isLast = n === 36
      const amort = isLast ? Math.round(saldo * 100) / 100 : 4166.66
      const juros = Math.round(saldo * 0.004868 * 100) / 100
      const closing = Math.round((saldo - amort) * 100) / 100
      rows.push({ number: n, status: n <= 12 ? 'PAID' : 'OPEN', openingBalance: saldo, interest: juros, amortization: amort, correcao: -juros, payment: Math.round((amort) * 100) / 100, closingBalance: closing })
      saldo = closing
    }
    const l570 = { principal: 104166.72, installmentsPaidBefore: 10, interestRateMonthly: 0.004868, rateType: 'POS' as const }
    expect(saldoDevedorAtual(l570, rows)).toBeCloseTo(100000.08, 1)
  })

  // ── Mútuo FLEXIBLE (Arafat): saldo = base − Σdevoluções, agenda nominal ignorada ──
  it('FLEXIBLE sem devolução → saldo = base (290.000)', () => {
    const insts = validSchedule() // nominal, nenhuma paga
    const arafat = { principal: 290000, installmentsPaidBefore: 0, interestRateMonthly: 0, rateType: 'PRE' as const, scheduleSource: 'FLEXIBLE' }
    expect(saldoDevedorAtual(arafat, insts)).toBeCloseTo(290000, 2)
  })

  it('FLEXIBLE: devolução de 45.000 (amort=45.000) → saldo 245.000, não depende do cronograma nominal', () => {
    // 1 parcela paga com amortização = valor devolvido (45.000), demais nominais abertas
    const rows: SaldoInstallment[] = [
      { number: 1, status: 'PAID', openingBalance: 290000, interest: 0, amortization: 45000, correcao: 0, payment: 45000, closingBalance: 245000 },
      { number: 2, status: 'OPEN', openingBalance: 248571.43, interest: 0, amortization: 41428.57, correcao: 0, payment: 41428.57, closingBalance: 207142.86 },
    ]
    const arafat = { principal: 290000, installmentsPaidBefore: 0, interestRateMonthly: 0, rateType: 'PRE' as const, scheduleSource: 'FLEXIBLE' }
    expect(saldoDevedorAtual(arafat, rows)).toBeCloseTo(245000, 2)
  })

  it('agenda QUEBRADA (Σamort ≠ base) → fórmula conservadora principal−Σpaid (não muda)', () => {
    // balão: só 2 parcelas com amort inflada, resto 0 → não fecha
    const rows: SaldoInstallment[] = [
      { number: 1, status: 'PAID', openingBalance: 0, interest: 0, amortization: 10234.35, correcao: 0, payment: 10234.35, closingBalance: 0 },
      { number: 2, status: 'PAID', openingBalance: 61406.1, interest: 0, amortization: 10234.35, correcao: 0, payment: 10234.35, closingBalance: 51171.75 },
    ]
    const broken = { principal: 61406.1, installmentsPaidBefore: 0, interestRateMonthly: 0.017, rateType: 'PRE' as const }
    // agenda inválida → principal − Σpaid = 61406.10 − 20468.70 = 40937.40 (valor atual, não muda)
    expect(saldoDevedorAtual(broken, rows)).toBeCloseTo(40937.4, 2)
  })
})
