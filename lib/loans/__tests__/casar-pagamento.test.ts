import { describe, it, expect } from 'vitest'
import { regenerateSchedule, type RegenLoan, type RegenInstallment } from '../regenerate'
import { computeLinkSplit } from '../link-payment'
import { detectLoanPayment, type DetectLoanLite } from '../detect-payment'

// ===== FASE 2 — gerador SAC + valor financiado (caso C41022570) =====
describe('regenerateSchedule SAC (C41022570)', () => {
  const loan: RegenLoan = {
    principal: 104166.72, outstandingBalanceInitial: 104166.72, termMonths: 36,
    installmentsPaidBefore: 10, amortizationSystem: 'SAC', amortizationConstant: null,
    financedAmount: null, firstDueDate: new Date('2026-06-15'),
  }
  function seed(): RegenInstallment[] {
    const rows: RegenInstallment[] = []
    for (let n = 11; n <= 36; n++) rows.push({
      number: n, dueDate: new Date(Date.UTC(2026, 5 + (n - 11), 15)), openingBalance: 0, interest: 0,
      amortization: 0, correcao: 0, payment: 0, closingBalance: 0, status: 'OPEN', isEstimate: true,
      reconciledTransactionId: null, realPayment: null,
    })
    return rows
  }
  it('financiado 150.000 / 36 → amort 4.166,66 (truncado), agenda fecha', () => {
    const r = regenerateSchedule(loan, seed(), { system: 'SAC', financedAmount: 150000, rateMonthly: 0.004868, isPostFixed: true })
    expect(r.validation.ok).toBe(true)
    const p12 = r.rows.find((x) => x.number === 12)!
    expect(p12.amortization).toBeCloseTo(4166.66, 2)
    // saldo devedor #12: abre 104.166,72 → fecha 100.000,06 (aceite 7.1)
    expect(p12.openingBalance).toBeCloseTo(104166.72, 1)
    expect(p12.closingBalance).toBeCloseTo(100000.06, 1)
  })
})

// ===== FASE 4/5 — split do grupo (identidade PAGO = AMORT + ENCARGOS) =====
describe('computeLinkSplit', () => {
  it('caso julho C41022570: 5.951,33 = 4.166,66 amort + 1.784,67 encargos', () => {
    const s = computeLinkSplit({ installment: { amortization: 4166.66, openingBalance: 104166.72 }, rateMonthly: 0.004868, paidTotal: 5951.33 })
    expect(s.isPartial).toBe(false)
    expect(s.amortization).toBeCloseTo(4166.66, 2)
    expect(s.encargos).toBeCloseTo(1784.67, 2)
    // encargos = juros + correção (soma bate)
    expect(s.paidInterest + s.paidCorrection + s.paidPenalty).toBeCloseTo(1784.67, 2)
    // amort fora do DRE + encargos = pago
    expect(s.amortization + s.encargos).toBeCloseTo(5951.33, 2)
  })
  it('pagamento parcial (< amortização) → PARCIAL, não quita, sem encargos', () => {
    const s = computeLinkSplit({ installment: { amortization: 4166.66, openingBalance: 104166.72 }, rateMonthly: 0.004868, paidTotal: 3000 })
    expect(s.isPartial).toBe(true)
    expect(s.encargos).toBe(0)
    expect(s.amortization).toBeCloseTo(3000, 2)
  })
})

// ===== FASE 3 — detecção (contrato Sicredi vs candidatos Banrisul) =====
describe('detectLoanPayment', () => {
  const sicredi: DetectLoanLite = { id: 'L1', contractNumber: 'C41022570-0', lender: 'Sicredi', status: 'ACTIVE', dueDay: 15 }
  const banr1: DetectLoanLite = { id: 'B1', contractNumber: '002100057538834', lender: 'Banrisul', status: 'ACTIVE', dueDay: 26 }
  const banr2: DetectLoanLite = { id: 'B2', contractNumber: '002100064956967', lender: 'Banrisul', status: 'ACTIVE', dueDay: 11 }

  it('Sicredi: contrato na descrição → vínculo direto', () => {
    const d = detectLoanPayment({ description: 'AMORTIZACAO CONTRATO-C41022570', type: 'DEBIT', date: '2026-07-15' }, [sicredi])
    expect(d).toMatchObject({ kind: 'CONTRACT', loanId: 'L1' })
  })
  it('Banrisul: "EMPRESTIMO" sem número + 2 empréstimos → CANDIDATOS, NÃO escolhe sozinho', () => {
    const d = detectLoanPayment({ description: 'EMPRESTIMO', type: 'DEBIT', date: '2026-07-26' }, [banr1, banr2])
    expect(d?.kind).toBe('CANDIDATES')
    if (d?.kind === 'CANDIDATES') {
      expect(d.candidates.length).toBe(2)
      // ranqueia dia 26 primeiro (vence dia 26)
      expect(d.candidates[0].loanId).toBe('B1')
    }
  })
  it('contrato sem empréstimo cadastrado → avisa cadastrar', () => {
    const d = detectLoanPayment({ description: 'AMORTIZACAO CONTRATO-C99999999', type: 'DEBIT', date: '2026-07-15' }, [sicredi])
    expect(d?.kind).toBe('NOT_REGISTERED')
  })
  it('descrição comum (não empréstimo) → null', () => {
    expect(detectLoanPayment({ description: 'PIX RECEBIDO', type: 'DEBIT', date: '2026-07-15' }, [sicredi])).toBeNull()
  })
})
