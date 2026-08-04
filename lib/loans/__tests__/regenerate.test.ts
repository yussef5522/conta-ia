import { describe, it, expect } from 'vitest'
import { regenerateSchedule, type RegenInstallment, type RegenLoan } from '../regenerate'

const loan: RegenLoan = {
  principal: 100000, outstandingBalanceInitial: 100000, termMonths: 36,
  installmentsPaidBefore: 0, amortizationSystem: 'PRICE', amortizationConstant: null,
  firstDueDate: new Date('2026-01-15'),
}

// 36 parcelas "atuais" (estado qualquer — o que importa é number + reconciliação).
function seed(overrides: Partial<RegenInstallment>[] = []): RegenInstallment[] {
  const rows: RegenInstallment[] = []
  for (let n = 1; n <= 36; n++) {
    rows.push({
      number: n, dueDate: new Date(Date.UTC(2026, n - 1, 15)), openingBalance: 0, interest: 0,
      amortization: 0, correcao: 0, payment: 0, closingBalance: 0, status: 'OPEN', isEstimate: true,
      reconciledTransactionId: null, realPayment: null,
    })
  }
  for (const o of overrides) { const i = rows.findIndex((r) => r.number === o.number); if (i >= 0) rows[i] = { ...rows[i], ...o } }
  return rows
}

describe('regenerateSchedule', () => {
  it('parcela válida → agenda fecha e preserva reconciliação', () => {
    const insts = seed([{ number: 5, status: 'PAID', reconciledTransactionId: 'tx5', realPayment: 3800 }])
    const r = regenerateSchedule(loan, insts, { parcela: 3800, rateMonthly: 0.017, isPostFixed: true })
    expect(r.validation.ok).toBe(true)
    expect(r.blocked).toBe(false)
    const rec5 = r.reconciled.find((x) => x.number === 5)
    expect(rec5?.preserved).toBe(true)
    expect(rec5?.depois).not.toBeNull()
    // split recomputado com valor real (3800) sobre amort nova: juros+corr+amort = 3800
    if (rec5?.depois) expect(rec5.depois.interest + rec5.depois.correcao + rec5.depois.amortization).toBeCloseTo(3800, 1)
  })

  it('parcela baixa demais (parcela×prazo < saldo) → não fecha, NÃO grava', () => {
    const r = regenerateSchedule(loan, seed(), { parcela: 2700, rateMonthly: 0.017, isPostFixed: true })
    expect(r.validation.ok).toBe(false)
    expect(r.validation.errors.join(' ')).toMatch(/não fecha|nao fecha|saldo/i)
  })

  it('reconciliada FORA do novo cronograma → blocked (não perde vínculo)', () => {
    // parcela #40 reconciliada mas termMonths=36 → some do novo cronograma
    const insts = seed()
    insts.push({ number: 40, dueDate: new Date('2029-01-15'), openingBalance: 0, interest: 0, amortization: 0, correcao: 0, payment: 3800, closingBalance: 0, status: 'PAID', isEstimate: false, reconciledTransactionId: 'tx40', realPayment: 3800 })
    const r = regenerateSchedule(loan, insts, { parcela: 3800, rateMonthly: 0.017, isPostFixed: true })
    expect(r.blocked).toBe(true)
    expect(r.blockReason).toMatch(/#40|vínculo|somem/i)
  })

  it('pré-fixado com taxa 0 seria pego pelo guard (não silencia)', () => {
    const r = regenerateSchedule(loan, seed(), { parcela: 3800, rateMonthly: 0, isPostFixed: false })
    // rate 0 + PRICE → PMT = saldo/prazo; juros 0 é legítimo quando taxa=0 (ratePositive=false)
    expect(r.ratePositive).toBe(false)
    expect(r.validation.ok).toBe(true) // taxa zero é permitida; guard de juros>0 só vale com taxa>0
  })
})
