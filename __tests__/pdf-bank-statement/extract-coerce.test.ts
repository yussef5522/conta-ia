// Sprint PDF Extrato Bancário — testes do coerce (defensivo contra IA volátil)

import { describe, it, expect } from 'vitest'
import { coerceExtraction } from '@/lib/pdf-bank-statement/extract'

describe('coerceExtraction', () => {
  it('aceita shape ideal', () => {
    const r = coerceExtraction({
      openingBalance: 1000,
      closingBalance: 800,
      periodStart: '2026-06-01',
      periodEnd: '2026-06-30',
      detectedBank: 'Caixa',
      scanQuality: 'GOOD',
      notes: ['ok'],
      lines: [
        {
          date: '2026-06-02',
          description: 'PIX RECEBIDO',
          amount: 200,
          type: 'CREDIT',
          balanceAfter: 1200,
        },
      ],
    })
    expect(r.openingBalance).toBe(1000)
    expect(r.closingBalance).toBe(800)
    expect(r.detectedBank).toBe('Caixa')
    expect(r.scanQuality).toBe('GOOD')
    expect(r.lines).toHaveLength(1)
    expect(r.lines[0].balanceAfter).toBe(1200)
  })

  it('descarta linha sem date', () => {
    const r = coerceExtraction({
      lines: [
        { description: 'X', amount: 100, type: 'DEBIT' },
        { date: '2026-06-01', description: 'OK', amount: 50, type: 'CREDIT' },
      ],
    })
    expect(r.lines).toHaveLength(1)
    expect(r.lines[0].description).toBe('OK')
  })

  it('descarta linha com amount <= 0 (sinal não vai aqui)', () => {
    const r = coerceExtraction({
      lines: [
        { date: '2026-06-01', description: 'X', amount: -100, type: 'DEBIT' },
        { date: '2026-06-01', description: 'Y', amount: 0, type: 'CREDIT' },
        { date: '2026-06-01', description: 'Z', amount: 50, type: 'CREDIT' },
      ],
    })
    expect(r.lines).toHaveLength(1)
    expect(r.lines[0].description).toBe('Z')
  })

  it('aceita type case-insensitive', () => {
    const r = coerceExtraction({
      lines: [
        { date: '2026-06-01', description: 'A', amount: 10, type: 'credit' },
        { date: '2026-06-01', description: 'B', amount: 20, type: 'Debit' },
      ],
    })
    expect(r.lines).toHaveLength(2)
    expect(r.lines[0].type).toBe('CREDIT')
    expect(r.lines[1].type).toBe('DEBIT')
  })

  it('descarta linha com type inválido', () => {
    const r = coerceExtraction({
      lines: [
        { date: '2026-06-01', description: 'X', amount: 10, type: 'TRANSFER' },
        { date: '2026-06-01', description: 'Y', amount: 20, type: 'CREDIT' },
      ],
    })
    expect(r.lines).toHaveLength(1)
    expect(r.lines[0].description).toBe('Y')
  })

  it('coage string com vírgula BR pra número', () => {
    // Claude pode mandar "1.234,56" se driftar do prompt
    const r = coerceExtraction({
      openingBalance: '1.234,56',
      lines: [{ date: '2026-06-01', description: 'X', amount: '10,50', type: 'CREDIT' }],
    })
    expect(r.openingBalance).toBe(1234.56)
    expect(r.lines[0].amount).toBe(10.5)
  })

  it('preserva needsReview e note quando presentes', () => {
    const r = coerceExtraction({
      lines: [
        {
          date: '2026-06-01',
          description: 'X',
          amount: 10,
          type: 'DEBIT',
          needsReview: true,
          note: 'Verificar valor',
        },
      ],
    })
    expect(r.lines[0].needsReview).toBe(true)
    expect(r.lines[0].note).toBe('Verificar valor')
  })

  it('normaliza scanQuality inválida pra UNKNOWN', () => {
    const r = coerceExtraction({ scanQuality: 'EXCELLENT' })
    expect(r.scanQuality).toBe('UNKNOWN')
  })

  it('lida com input null/undefined', () => {
    const r = coerceExtraction(null)
    expect(r.lines).toEqual([])
    expect(r.openingBalance).toBeNull()
    expect(r.scanQuality).toBe('UNKNOWN')
  })

  it('trim em description', () => {
    const r = coerceExtraction({
      lines: [{ date: '2026-06-01', description: '   PIX   ', amount: 10, type: 'CREDIT' }],
    })
    expect(r.lines[0].description).toBe('PIX')
  })

  it('filtra notes vazios', () => {
    const r = coerceExtraction({ notes: ['ok', '', null, 'mais um'] })
    expect(r.notes).toEqual(['ok', 'mais um'])
  })
})
