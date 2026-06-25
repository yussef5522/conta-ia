// Sprint Cartao Credito PJ — testes de totals-check (puro)

import { describe, it, expect } from 'vitest'
import { checkInvoiceTotals } from '@/lib/credit-card-pj/totals-check'
import type { InvoiceExtraction } from '@/lib/credit-card-pj/types'

function mk(overrides: Partial<InvoiceExtraction> = {}): InvoiceExtraction {
  return {
    dueDate: null,
    closingDate: null,
    totalDeclared: null,
    creditLimit: null,
    availableLimit: null,
    detectedBank: null,
    cardLastDigitsFound: [],
    scanQuality: 'GOOD',
    notes: [],
    lines: [],
    ...overrides,
  }
}

describe('checkInvoiceTotals', () => {
  it('soma confere quando compras + encargos == totalDeclared', () => {
    const r = checkInvoiceTotals(mk({
      totalDeclared: 1000,
      lines: [
        { date: '2026-06-01', description: 'FACEBK', amount: 500, suggestedKind: 'COMPRA_AVISTA' },
        { date: '2026-06-02', description: 'ML 03/12', amount: 400, suggestedKind: 'COMPRA_PARCELADA', installmentNumber: 3, installmentTotal: 12 },
        { date: '2026-06-03', description: 'JUROS', amount: 100, suggestedKind: 'ENCARGO_FINANCEIRO' },
      ],
    }))
    expect(r.matches).toBe(true)
    expect(r.totalCompras).toBe(900)
    expect(r.totalEncargos).toBe(100)
    expect(r.totalCalculado).toBe(1000)
  })

  it('IGNORAR não conta na soma', () => {
    const r = checkInvoiceTotals(mk({
      totalDeclared: 500,
      lines: [
        { date: '2026-06-01', description: 'TOTAL FATURA ANTERIOR', amount: 2000, suggestedKind: 'IGNORAR' },
        { date: '2026-06-02', description: 'PAGAMENTO RECEBIDO', amount: 1500, suggestedKind: 'IGNORAR' },
        { date: '2026-06-03', description: 'FACEBK', amount: 500, suggestedKind: 'COMPRA_AVISTA' },
      ],
    }))
    expect(r.matches).toBe(true)
    expect(r.totalCompras).toBe(500)
    expect(r.totalIgnoradas).toBe(3500)
  })

  it('detecta soma errada (faltou linha)', () => {
    const r = checkInvoiceTotals(mk({
      totalDeclared: 1000,
      lines: [{ date: '2026-06-01', description: 'X', amount: 800, suggestedKind: 'COMPRA_AVISTA' }],
    }))
    expect(r.matches).toBe(false)
    expect(r.diferenca).toBe(200)
    expect(r.message).toContain('Soma não fecha')
  })

  it('insufficient quando totalDeclared é null', () => {
    const r = checkInvoiceTotals(mk({ totalDeclared: null, lines: [] }))
    expect(r.insufficient).toBe(true)
    expect(r.matches).toBe(false)
  })

  it('tolerância R$ 0,02', () => {
    const r = checkInvoiceTotals(mk({
      totalDeclared: 100.00,
      lines: [{ date: '2026-06-01', description: 'X', amount: 99.99, suggestedKind: 'COMPRA_AVISTA' }],
    }))
    expect(r.matches).toBe(true)
  })

  it('mistura compras + parceladas + encargos', () => {
    const r = checkInvoiceTotals(mk({
      totalDeclared: 2500,
      lines: [
        { date: '2026-06-01', description: 'A', amount: 1000, suggestedKind: 'COMPRA_AVISTA' },
        { date: '2026-06-02', description: 'B', amount: 800, suggestedKind: 'COMPRA_PARCELADA', installmentNumber: 2, installmentTotal: 6 },
        { date: '2026-06-03', description: 'JUROS', amount: 500, suggestedKind: 'ENCARGO_FINANCEIRO' },
        { date: '2026-06-04', description: 'IGN', amount: 999, suggestedKind: 'IGNORAR' },
        { date: '2026-06-05', description: 'IOF', amount: 200, suggestedKind: 'ENCARGO_FINANCEIRO' },
      ],
    }))
    expect(r.matches).toBe(true)
    expect(r.totalCompras).toBe(1800)
    expect(r.totalEncargos).toBe(700)
    expect(r.totalIgnoradas).toBe(999)
  })
})
