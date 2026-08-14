// Sprint Fatura-Estorno — REGRA 3: o estorno REDUZ o total; a validação é contra
// "Total desta Fatura" (não "Total cartão"). Trava com o FIXTURE REAL do Sicredi.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseSicrediFatura } from '../deterministic/sicredi-fatura-parser'
import { checkInvoiceTotals } from '../totals-check'
import type { InvoiceExtraction, InvoiceLine } from '../types'

const REAL = readFileSync(
  fileURLToPath(new URL('../deterministic/__tests__/fixtures/sicredi-fatura-real.txt', import.meta.url)),
  'utf8',
)

const line = (kind: InvoiceLine['suggestedKind'], amount: number): InvoiceLine => ({
  date: '2026-07-01', description: 'x', amount, suggestedKind: kind,
})
const extraction = (over: Partial<InvoiceExtraction>): InvoiceExtraction => ({
  dueDate: null, closingDate: null, totalDeclared: null, totalToPay: null, creditLimit: null,
  availableLimit: null, detectedBank: 'Sicredi', cardLastDigitsFound: [], scanQuality: 'GOOD',
  lines: [], notes: [], ...over,
})

describe('checkInvoiceTotals — estorno reduz, valida contra Total desta Fatura', () => {
  it('compras 100 + encargo 5 − estorno 3 = 102 = Total desta Fatura → fecha', () => {
    const r = checkInvoiceTotals(extraction({
      totalDeclared: 105, // Total cartão
      totalToPay: 102, // Total desta Fatura
      lines: [line('COMPRA_AVISTA', 100), line('ENCARGO_FINANCEIRO', 5), line('ESTORNO', 3)],
    }))
    expect(r.matches).toBe(true)
    expect(r.totalCartao).toBe(105)
    expect(r.totalFatura).toBe(102)
    expect(r.message).toMatch(/Total desta Fatura/i)
  })

  it('IGNORAR o estorno (bug antigo): 105 ≠ 102 → NÃO fecha', () => {
    const r = checkInvoiceTotals(extraction({
      totalDeclared: 105, totalToPay: 102,
      lines: [line('COMPRA_AVISTA', 100), line('ENCARGO_FINANCEIRO', 5)], // sem estorno
    }))
    expect(r.matches).toBe(false)
    expect(r.message).toMatch(/não fecha|estorno/i)
  })

  it('FIXTURE REAL: fecha em Total desta Fatura 7.896,32 (não no Total cartão 7.995,55)', () => {
    const parsed = parseSicrediFatura(REAL)
    const r = checkInvoiceTotals(parsed.extraction)
    expect(r.totalCartao).toBe(7995.55)
    expect(r.totalEstornos).toBe(99.23)
    expect(r.totalFatura).toBe(7896.32) // = o que sai do banco / casa com o pagamento
    expect(r.totalDeclaradoFatura).toBe(7896.32)
    expect(r.matches).toBe(true)
  })
})
