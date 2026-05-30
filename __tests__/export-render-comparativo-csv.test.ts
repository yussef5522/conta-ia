// Sprint Export CSV+PDF (29/05/2026) — Testes builder Comparativo CSV.

import { describe, it, expect } from 'vitest'
import { renderComparativoCSV } from '@/lib/export/render/comparativo'
import type { ComparativoMultiResult } from '@/lib/relatorios/comparativo'

function fakeResult(overrides?: Partial<ComparativoMultiResult>): ComparativoMultiResult {
  return {
    periodos: [
      { id: '2026-01', label: 'Jan/26', start: new Date('2026-01-01'), end: new Date('2026-01-31') },
      { id: '2026-02', label: 'Fev/26', start: new Date('2026-02-01'), end: new Date('2026-02-28') },
      { id: '2026-03', label: 'Mar/26', start: new Date('2026-03-01'), end: new Date('2026-03-31') },
    ],
    rows: [
      {
        categoryId: 'c1',
        categoryName: 'Salários',
        dreGroup: null,
        values: [44032.5, 38977, 40500],
        mediaHistorica: 41505,
        desvioPct: -0.024,
        referenciaVazia: false,
        total: 123509.5,
        trend: { indicator: 'STABLE', percentVsPrev1: null, percentVsPrev2: null },
        cellTones: ['transparent', 'fav-weak', 'transparent'],
      },
    ],
    totals: {
      porPeriodo: [44032.5, 38977, 40500],
      mediaHistorica: 41505,
      desvioPct: -0.024,
      referenciaVazia: false,
      total: 123509.5,
    },
    summary: { novas: 0, subindo: 0, descendo: 1, foraDaMedia: 0 },
    ...overrides,
  }
}

describe('renderComparativoCSV', () => {
  it('inclui BOM + vírgula + decimais BR', () => {
    const csv = renderComparativoCSV(fakeResult())
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('Categoria,Jan/26,Fev/26,Mar/26,Média,vs Média (%),Total')
    expect(csv).toContain('"44.032,50"')
  })

  it('row total bate com soma dos values', () => {
    const csv = renderComparativoCSV(fakeResult())
    // Salários: 44032.50 + 38977.00 + 40500.00 = 123509.50
    expect(csv).toContain('"123.509,50"')
  })

  it('aritmética: total da row = soma dos values do CSV', () => {
    const result = fakeResult({
      rows: [
        {
          categoryId: 'c1',
          categoryName: 'X',
          dreGroup: null,
          values: [100, 200, 300],
          mediaHistorica: 200,
          desvioPct: 0.5,
          referenciaVazia: false,
          total: 600,
          trend: { indicator: 'UP', percentVsPrev1: 0.5, percentVsPrev2: null },
          cellTones: ['transparent', 'transparent', 'unfav-strong'],
        },
      ],
      totals: {
        porPeriodo: [100, 200, 300],
        mediaHistorica: 200,
        desvioPct: 0.5,
        referenciaVazia: false,
        total: 600,
      },
    })
    const csv = renderComparativoCSV(result)
    expect(csv).toContain('X,"100,00","200,00","300,00","200,00","+50,0%","600,00"')
    expect(csv).toContain('TOTAL,"100,00","200,00","300,00","200,00","+50,0%","600,00"')
  })

  it('referenciaVazia → "ref. vazia" no lugar do desvio', () => {
    const result = fakeResult({
      rows: [
        {
          categoryId: 'c1', categoryName: 'X', dreGroup: null,
          values: [0, 0, 0],
          mediaHistorica: 1000,
          desvioPct: null,
          referenciaVazia: true,
          total: 0,
          trend: { indicator: 'GONE', percentVsPrev1: null, percentVsPrev2: null },
          cellTones: ['transparent', 'transparent', 'transparent'],
        },
      ],
    })
    const csv = renderComparativoCSV(result)
    expect(csv).toContain('ref. vazia')
  })

  it('escapa categoria com vírgula no nome', () => {
    const r = fakeResult({
      rows: [
        {
          categoryId: 'c1',
          categoryName: 'Salários, com vírgula',
          dreGroup: null,
          values: [1000, 1000, 1000],
          mediaHistorica: 1000,
          desvioPct: 0,
          referenciaVazia: false,
          total: 3000,
          trend: { indicator: 'STABLE', percentVsPrev1: null, percentVsPrev2: null },
          cellTones: ['transparent', 'transparent', 'transparent'],
        },
      ],
    })
    const csv = renderComparativoCSV(r)
    expect(csv).toContain('"Salários, com vírgula"')
  })
})
