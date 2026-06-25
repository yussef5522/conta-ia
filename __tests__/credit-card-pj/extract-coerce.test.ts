// Sprint Cartao Credito PJ — coerce defensivo do output da IA

import { describe, it, expect } from 'vitest'
import { coerceInvoiceExtraction } from '@/lib/credit-card-pj/extract'

describe('coerceInvoiceExtraction', () => {
  it('aceita shape ideal', () => {
    const r = coerceInvoiceExtraction({
      dueDate: '2026-07-10',
      closingDate: '2026-06-25',
      totalDeclared: 4333.41,
      creditLimit: 8000,
      availableLimit: 3666.59,
      detectedBank: 'Caixa',
      cardLastDigitsFound: ['2937', '3883'],
      scanQuality: 'GOOD',
      notes: [],
      lines: [
        { date: '2026-06-02', description: 'FACEBK ADS', amount: 350, suggestedKind: 'COMPRA_AVISTA', cardLastDigits: '2937' },
        { date: '2026-06-05', description: 'MERCADOLIVRE 08/12', amount: 233.5, suggestedKind: 'COMPRA_PARCELADA', installmentNumber: 8, installmentTotal: 12 },
      ],
    })
    expect(r.dueDate).toBe('2026-07-10')
    expect(r.detectedBank).toBe('Caixa')
    expect(r.cardLastDigitsFound).toEqual(['2937', '3883'])
    expect(r.lines).toHaveLength(2)
    expect(r.lines[0].cardLastDigits).toBe('2937')
    expect(r.lines[1].installmentNumber).toBe(8)
    expect(r.lines[1].installmentTotal).toBe(12)
  })

  it('descarta linha com kind inválido', () => {
    const r = coerceInvoiceExtraction({
      lines: [
        { date: '2026-06-01', description: 'X', amount: 10, suggestedKind: 'TRANSFER' },
        { date: '2026-06-01', description: 'Y', amount: 20, suggestedKind: 'COMPRA_AVISTA' },
      ],
    })
    expect(r.lines).toHaveLength(1)
    expect(r.lines[0].description).toBe('Y')
  })

  it('descarta linha com amount ≤ 0', () => {
    const r = coerceInvoiceExtraction({
      lines: [
        { date: '2026-06-01', description: 'X', amount: -100, suggestedKind: 'COMPRA_AVISTA' },
        { date: '2026-06-01', description: 'Y', amount: 0, suggestedKind: 'COMPRA_AVISTA' },
        { date: '2026-06-01', description: 'Z', amount: 50, suggestedKind: 'COMPRA_AVISTA' },
      ],
    })
    expect(r.lines).toHaveLength(1)
    expect(r.lines[0].description).toBe('Z')
  })

  it('aceita kind case-insensitive e com hifens', () => {
    const r = coerceInvoiceExtraction({
      lines: [
        { date: '2026-06-01', description: 'A', amount: 10, suggestedKind: 'compra_avista' },
        { date: '2026-06-01', description: 'B', amount: 20, suggestedKind: 'COMPRA-PARCELADA' },
        { date: '2026-06-01', description: 'C', amount: 30, suggestedKind: 'encargo-financeiro' },
        { date: '2026-06-01', description: 'D', amount: 40, suggestedKind: 'IGNORAR' },
      ],
    })
    expect(r.lines).toHaveLength(4)
    expect(r.lines.map((l) => l.suggestedKind)).toEqual([
      'COMPRA_AVISTA',
      'COMPRA_PARCELADA',
      'ENCARGO_FINANCEIRO',
      'IGNORAR',
    ])
  })

  it('filtra cardLastDigitsFound inválidos', () => {
    const r = coerceInvoiceExtraction({
      cardLastDigitsFound: ['2937', 'abc', '38830', '12', null, undefined, '1', '12345'],
    })
    // Aceita 2-6 digits
    expect(r.cardLastDigitsFound).toEqual(['2937', '38830', '12', '12345'])
  })

  it('coage string PT-BR com vírgula em números', () => {
    const r = coerceInvoiceExtraction({
      totalDeclared: '4.333,41',
      lines: [{ date: '2026-06-01', description: 'X', amount: '233,50', suggestedKind: 'COMPRA_AVISTA' }],
    })
    expect(r.totalDeclared).toBe(4333.41)
    expect(r.lines[0].amount).toBe(233.5)
  })

  it('input null/undefined retorna shape vazio', () => {
    const r = coerceInvoiceExtraction(null)
    expect(r.lines).toEqual([])
    expect(r.totalDeclared).toBeNull()
    expect(r.scanQuality).toBe('UNKNOWN')
    expect(r.cardLastDigitsFound).toEqual([])
  })

  it('scanQuality inválido vira UNKNOWN', () => {
    const r = coerceInvoiceExtraction({ scanQuality: 'EXCELLENT' })
    expect(r.scanQuality).toBe('UNKNOWN')
  })

  it('preserva needsReview + note', () => {
    const r = coerceInvoiceExtraction({
      lines: [{
        date: '2026-06-01',
        description: 'X',
        amount: 10,
        suggestedKind: 'COMPRA_AVISTA',
        needsReview: true,
        note: 'Verifique valor',
      }],
    })
    expect(r.lines[0].needsReview).toBe(true)
    expect(r.lines[0].note).toBe('Verifique valor')
  })

  it('descarta installmentNumber/Total inválidos', () => {
    const r = coerceInvoiceExtraction({
      lines: [{
        date: '2026-06-01',
        description: 'X',
        amount: 10,
        suggestedKind: 'COMPRA_PARCELADA',
        installmentNumber: -1,
        installmentTotal: 0,
      }],
    })
    expect(r.lines[0].installmentNumber).toBeUndefined()
    expect(r.lines[0].installmentTotal).toBeUndefined()
  })

  it('trim description', () => {
    const r = coerceInvoiceExtraction({
      lines: [{ date: '2026-06-01', description: '   FACEBK   ', amount: 10, suggestedKind: 'COMPRA_AVISTA' }],
    })
    expect(r.lines[0].description).toBe('FACEBK')
  })
})
