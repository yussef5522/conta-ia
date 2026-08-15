// Sprint Fatura-Net-Unico — REGRA 3: a ÚNICA função de total. O estorno subtrai;
// import e display dão o MESMO número; o casar acha o mês pelo valor (não "recente").

import { describe, it, expect } from 'vitest'
import { faturaNetTotal, signedFaturaAmount, pickInvoiceMonthByValue } from '../fatura-net-total'
import { checkInvoiceTotals } from '../totals-check'
import type { InvoiceExtraction, InvoiceLine } from '../types'

describe('faturaNetTotal — estorno subtrai, pagamento não conta', () => {
  it('76 DEBIT 7995.55 + 1 CREDIT 99.23 → net 7896.32 (o caso real)', () => {
    const items = [
      { type: 'DEBIT', amount: 7995.55 },
      { type: 'CREDIT', amount: 99.23 },
      { type: 'DEBIT', amount: 7896.32, isCardPayment: true }, // pagamento: ignora
    ]
    const r = faturaNetTotal(items)
    expect(r.compras).toBe(7995.55)
    expect(r.estornos).toBe(99.23)
    expect(r.net).toBe(7896.32)
  })
  it('signedFaturaAmount: CREDIT negativo, pagamento zero', () => {
    expect(signedFaturaAmount({ type: 'CREDIT', amount: 99.23 })).toBe(-99.23)
    expect(signedFaturaAmount({ type: 'DEBIT', amount: 10 })).toBe(10)
    expect(signedFaturaAmount({ type: 'DEBIT', amount: 10, isCardPayment: true })).toBe(0)
  })
})

describe('import e display dão o MESMO net (uma fonte)', () => {
  const line = (kind: InvoiceLine['suggestedKind'], amount: number): InvoiceLine => ({
    date: '2026-07-01', description: 'x', amount, suggestedKind: kind,
  })
  const ext = (over: Partial<InvoiceExtraction>): InvoiceExtraction => ({
    dueDate: null, closingDate: null, totalDeclared: 7995.55, totalToPay: 7896.32, creditLimit: null,
    availableLimit: null, detectedBank: 'Sicredi', cardLastDigitsFound: [], scanQuality: 'GOOD',
    lines: [], notes: [], ...over,
  })
  it('checkInvoiceTotals.totalFatura == faturaNetTotal.net', () => {
    const lines = [line('COMPRA_AVISTA', 7900), line('ENCARGO_FINANCEIRO', 95.55), line('ESTORNO', 99.23)]
    const check = checkInvoiceTotals(ext({ lines }))
    const net = faturaNetTotal(lines.map((l) => ({ type: l.suggestedKind === 'ESTORNO' ? 'CREDIT' : 'DEBIT', amount: l.amount }))).net
    expect(check.totalFatura).toBe(7896.32)
    expect(check.totalFatura).toBe(net)
    expect(check.matches).toBe(true)
  })
})

describe('pickInvoiceMonthByValue — o mês pelo VALOR, não "o mais recente"', () => {
  it('o bug real: pagamento 7896.32 → agosto (net bate), NÃO julho (mais recente)', () => {
    const net = new Map<string, number>([
      ['2026-07', 2304.83],
      ['2026-08', 7896.32], // net = 7995.55 − 99.23
    ])
    expect(pickInvoiceMonthByValue(net, 7896.32)).toBe('2026-08')
  })
  it('sem match por valor → cai na mais recente (fallback)', () => {
    const net = new Map<string, number>([['2026-06', 100], ['2026-07', 200]])
    expect(pickInvoiceMonthByValue(net, 9999)).toBe('2026-07')
  })
})
