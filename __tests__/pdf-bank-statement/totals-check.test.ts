// Sprint PDF Extrato Bancário — testes de totais-check (puro)

import { describe, it, expect } from 'vitest'
import { checkTotals } from '@/lib/pdf-bank-statement/totals-check'
import type { PdfBankStatementExtraction } from '@/lib/pdf-bank-statement/types'

function mkExtraction(overrides: Partial<PdfBankStatementExtraction> = {}): PdfBankStatementExtraction {
  return {
    openingBalance: null,
    closingBalance: null,
    periodStart: null,
    periodEnd: null,
    detectedBank: null,
    scanQuality: 'GOOD',
    notes: [],
    lines: [],
    ...overrides,
  }
}

describe('checkTotals', () => {
  it('confere totais quando soma bate exato', () => {
    const r = checkTotals(mkExtraction({
      openingBalance: 1000,
      closingBalance: 850,
      lines: [
        { date: '2026-06-01', description: 'PIX RECEBIDO', amount: 500, type: 'CREDIT' },
        { date: '2026-06-02', description: 'TARIFA', amount: 50, type: 'DEBIT' },
        { date: '2026-06-03', description: 'PARC FIN', amount: 600, type: 'DEBIT' },
      ],
    }))
    expect(r.matches).toBe(true)
    expect(r.insufficient).toBe(false)
    expect(r.totalEntradas).toBe(500)
    expect(r.totalSaidas).toBe(650)
    expect(r.saldoCalculado).toBe(850)
    expect(r.diferenca).toBe(0)
  })

  it('confere com tolerância de R$ 0,02 (arredondamento)', () => {
    const r = checkTotals(mkExtraction({
      openingBalance: 100,
      closingBalance: 99.99,
      lines: [{ date: '2026-06-01', description: 'TARIFA', amount: 0.02, type: 'DEBIT' }],
    }))
    // Calculado = 100 - 0.02 = 99.98; declarado = 99.99; dif = 0.01 → matches
    expect(r.matches).toBe(true)
    expect(Math.abs(r.diferenca ?? 999)).toBeLessThanOrEqual(0.02)
  })

  it('detecta não-conferência (faltou linha)', () => {
    const r = checkTotals(mkExtraction({
      openingBalance: 1000,
      closingBalance: 500,
      lines: [
        // Só registramos 200 de saídas, mas extrato diz que saldo caiu 500
        { date: '2026-06-01', description: 'TARIFA', amount: 200, type: 'DEBIT' },
      ],
    }))
    expect(r.matches).toBe(false)
    expect(r.insufficient).toBe(false)
    expect(r.saldoCalculado).toBe(800)
    expect(r.saldoDeclarado).toBe(500)
    expect(r.diferenca).toBe(-300) // declarado < calculado → faltou saída
    expect(r.message).toContain('soma não fecha')
  })

  it('retorna insufficient quando openingBalance é null', () => {
    const r = checkTotals(mkExtraction({
      openingBalance: null,
      closingBalance: 500,
      lines: [{ date: '2026-06-01', description: 'X', amount: 100, type: 'CREDIT' }],
    }))
    expect(r.insufficient).toBe(true)
    expect(r.matches).toBe(false)
    expect(r.message).toContain('Saldo inicial')
  })

  it('retorna insufficient quando closingBalance é null', () => {
    const r = checkTotals(mkExtraction({
      openingBalance: 100,
      closingBalance: null,
      lines: [],
    }))
    expect(r.insufficient).toBe(true)
    expect(r.message).toContain('Saldo final')
  })

  it('retorna insufficient com ambos null (mensagem combinada)', () => {
    const r = checkTotals(mkExtraction({
      openingBalance: null,
      closingBalance: null,
    }))
    expect(r.insufficient).toBe(true)
    expect(r.message).toContain('Saldos inicial e final')
  })

  it('lida com extrato sem linhas (só saldos)', () => {
    const r = checkTotals(mkExtraction({
      openingBalance: 1000,
      closingBalance: 1000,
      lines: [],
    }))
    expect(r.matches).toBe(true)
    expect(r.totalEntradas).toBe(0)
    expect(r.totalSaidas).toBe(0)
  })

  it('valores grandes e múltiplas linhas mantêm precisão', () => {
    const lines = [
      { date: '2026-06-01', description: 'Receita', amount: 12345.67, type: 'CREDIT' as const },
      { date: '2026-06-02', description: 'Despesa A', amount: 1234.56, type: 'DEBIT' as const },
      { date: '2026-06-03', description: 'Despesa B', amount: 2345.67, type: 'DEBIT' as const },
    ]
    const r = checkTotals(mkExtraction({
      openingBalance: 10000,
      closingBalance: 10000 + 12345.67 - 1234.56 - 2345.67,
      lines,
    }))
    expect(r.matches).toBe(true)
  })

  it('saldo negativo (cheque especial) confere igual', () => {
    const r = checkTotals(mkExtraction({
      openingBalance: -5000,
      closingBalance: -8000,
      lines: [{ date: '2026-06-01', description: 'PARC', amount: 3000, type: 'DEBIT' }],
    }))
    expect(r.matches).toBe(true)
    expect(r.saldoCalculado).toBe(-8000)
  })

  it('message verde menciona valores específicos quando bate', () => {
    const r = checkTotals(mkExtraction({
      openingBalance: 100,
      closingBalance: 150,
      lines: [{ date: '2026-06-01', description: 'PIX', amount: 50, type: 'CREDIT' }],
    }))
    expect(r.matches).toBe(true)
    expect(r.message).toContain('conferem')
  })
})
