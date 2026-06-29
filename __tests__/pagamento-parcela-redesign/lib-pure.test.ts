// Sprint Pagamento Parcela Redesign (28/06/2026) — lib PURA.

import { describe, it, expect } from 'vitest'
import {
  computeMatchConfidence,
  computePosFixedSplit,
  computePreFixedSplit,
  isTxInMatchWindow,
  PRE_FIXED_AMOUNT_TOL_ABS,
  POS_FIXED_AMOUNT_TOL_PCT,
} from '@/lib/loans/installment-match'

describe('isTxInMatchWindow — tolerância por isEstimate', () => {
  const PRE_FIX = {
    payment: 1000,
    dueDate: new Date('2026-06-24'),
    isEstimate: false,
  }
  const POS_FIX = {
    payment: 6822.93,
    dueDate: new Date('2026-06-24'),
    isEstimate: true,
  }
  const txMesma = (amount: number) => ({
    amount,
    date: new Date('2026-06-24'),
    type: 'DEBIT' as const,
  })

  it('PRÉ: valor exato bate', () => {
    expect(isTxInMatchWindow(PRE_FIX, txMesma(1000))).toBe(true)
  })
  it('PRÉ: ±R$ 1 bate', () => {
    expect(isTxInMatchWindow(PRE_FIX, txMesma(1000.99))).toBe(true)
    expect(isTxInMatchWindow(PRE_FIX, txMesma(999.01))).toBe(true)
  })
  it('PRÉ: > R$ 1 acima REJEITA', () => {
    expect(isTxInMatchWindow(PRE_FIX, txMesma(1002))).toBe(false)
  })

  it('🎯 POS-FIX caso real Caixa #30: 6822.93 planejado, 7093.19 real → bate', () => {
    expect(isTxInMatchWindow(POS_FIX, txMesma(7093.19))).toBe(true)
  })
  it('POS-FIX: +25% bate (limite)', () => {
    expect(isTxInMatchWindow(POS_FIX, txMesma(6822.93 * 1.249))).toBe(true)
  })
  it('POS-FIX: +25.1% REJEITA', () => {
    expect(isTxInMatchWindow(POS_FIX, txMesma(6822.93 * 1.251))).toBe(false)
  })

  it('janela ±7d: d+7 bate', () => {
    const tx = { amount: 7093.19, date: new Date('2026-07-01'), type: 'DEBIT' as const }
    expect(isTxInMatchWindow(POS_FIX, tx)).toBe(true)
  })
  it('janela ±7d: d+8 REJEITA', () => {
    const tx = { amount: 7093.19, date: new Date('2026-07-02'), type: 'DEBIT' as const }
    expect(isTxInMatchWindow(POS_FIX, tx)).toBe(false)
  })

  it('CREDIT NUNCA bate (parcela é DEBIT)', () => {
    expect(
      isTxInMatchWindow(POS_FIX, {
        amount: 7093.19,
        date: new Date('2026-06-24'),
        type: 'CREDIT',
      }),
    ).toBe(false)
  })

  it('constantes exportadas', () => {
    expect(PRE_FIXED_AMOUNT_TOL_ABS).toBe(1.0)
    expect(POS_FIXED_AMOUNT_TOL_PCT).toBe(0.25)
  })
})

describe('computePosFixedSplit — caso real parcela #30 C1827478', () => {
  it('🎯 amort 6549.52, opening 56165.26, rate 0.004868, realPayment 7093.19', () => {
    const r = computePosFixedSplit(
      { amortization: 6549.52, openingBalance: 56165.26 },
      7093.19,
      0.004868,
    )
    expect(r.interest).toBeCloseTo(273.41, 2)
    expect(r.correcao).toBeCloseTo(270.26, 2)
    expect(r.closingBalance).toBeCloseTo(49615.74, 2)
    expect(r.realPayment).toBe(7093.19)
    expect(r.totalDespesaFinanceira).toBeCloseTo(543.67, 2)
  })

  it('pagamento EXATO ao planejado: correcao = 0', () => {
    const r = computePosFixedSplit(
      { amortization: 6549.52, openingBalance: 56165.26 },
      6822.93,
      0.004868,
    )
    expect(r.interest).toBeCloseTo(273.41, 2)
    expect(r.correcao).toBeCloseTo(0, 1)
    expect(r.totalDespesaFinanceira).toBeCloseTo(273.41, 2)
  })

  it('pagamento ABAIXO do planejado (raro): correcao negativa', () => {
    const r = computePosFixedSplit(
      { amortization: 6549.52, openingBalance: 56165.26 },
      6500.00,
      0.004868,
    )
    expect(r.correcao).toBeLessThan(0)
  })
})

describe('computePreFixedSplit — pré-fixado mantém planejado, correcao=0', () => {
  it('payment R$ 2.567,74, interest 364.25, amort 2203.49', () => {
    const r = computePreFixedSplit({
      interest: 364.25,
      amortization: 2203.49,
      payment: 2567.74,
      openingBalance: 50000,
    })
    expect(r.realPayment).toBe(2567.74)
    expect(r.interest).toBe(364.25)
    expect(r.correcao).toBe(0)
    expect(r.closingBalance).toBeCloseTo(47796.51, 2)
    expect(r.totalDespesaFinanceira).toBe(364.25)
  })
})

describe('computeMatchConfidence — selo IA', () => {
  const INST = {
    payment: 6822.93,
    dueDate: new Date('2026-06-24'),
    isEstimate: true,
  }

  it('🎯 caso real parcela #30 (mesma data + +3.96% CDI) → "Confira"', () => {
    const r = computeMatchConfidence(INST, {
      amount: 7093.19,
      date: new Date('2026-06-24'),
    })
    // 0.5 base + 0.2 data exata + 0.1 CDI <=10% = 0.80 → "Confira"
    expect(r.score).toBeGreaterThanOrEqual(0.7)
    expect(r.label).toBe('Confira')
    expect(r.evidences).toContain('Mesma data do vencimento')
    expect(r.evidences.some((e) => e.includes('CDI'))).toBe(true)
  })

  it('valor exato + mesma data → "Tenho certeza"', () => {
    const r = computeMatchConfidence(INST, {
      amount: 6822.93,
      date: new Date('2026-06-24'),
    })
    // 0.5 + 0.2 + 0.15 = 0.85 → "Tenho certeza"
    expect(r.score).toBeGreaterThanOrEqual(0.85)
    expect(r.label).toBe('Tenho certeza')
  })

  it('diff > 25% pra cima → "Confira com atenção"', () => {
    const r = computeMatchConfidence(INST, {
      amount: 6822.93 * 1.40,
      date: new Date('2026-06-30'),
    })
    expect(r.label).toBe('Confira com atenção')
  })

  it('pagamento ABAIXO do planejado: penalidade', () => {
    const r = computeMatchConfidence(
      { payment: 1000, dueDate: new Date('2026-06-24'), isEstimate: false },
      { amount: 850, date: new Date('2026-06-24') },
    )
    expect(r.evidences.some((e) => e.includes('incomum'))).toBe(true)
  })
})
