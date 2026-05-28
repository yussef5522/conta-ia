// Sprint 5.0.4.0a (a2) — Tests do Comparativo 3 Meses.

import { describe, it, expect } from 'vitest'
import {
  trendIndicator,
  parseRefMonth,
  threeMonthsForRef,
  computeComparativo,
  filterRows,
  TREND_VISUAL,
  type ComparativoInputTx,
} from '@/lib/relatorios/comparativo'

// ─── trendIndicator ────────────────────────────────────────────────────

describe('trendIndicator — casos especiais', () => {
  it('Todos zero → EMPTY', () => {
    expect(trendIndicator(0, 0, 0).indicator).toBe('EMPTY')
  })

  it('Apareceu 1ª vez (prev2=0, prev1=0, current>0) → NEW', () => {
    expect(trendIndicator(0, 0, 100).indicator).toBe('NEW')
  })

  it('Sumiu (prev1>0, current=0) → GONE', () => {
    expect(trendIndicator(50, 100, 0).indicator).toBe('GONE')
  })

  it('Sumiu (apenas prev2>0, prev1=0, current=0) → GONE', () => {
    expect(trendIndicator(50, 0, 0).indicator).toBe('GONE')
  })

  it('NEW retorna percentVsPrev1=null', () => {
    expect(trendIndicator(0, 0, 100).percentVsPrev1).toBeNull()
  })

  it('GONE retorna percentVsPrev1=null', () => {
    expect(trendIndicator(50, 100, 0).percentVsPrev1).toBeNull()
  })
})

describe('trendIndicator — variações (15-50%, >50%, etc)', () => {
  it('UP_STRONG: subiu > +50% (Folha: 15k → 20k → 25k = +25% vs prev1)', () => {
    // 25 vs 20 = +25% → UP (não UP_STRONG)
    expect(trendIndicator(15, 20, 25).indicator).toBe('UP')
  })

  it('UP_STRONG: subiu MUITO (5 → 10 → 20 = +100% vs prev1)', () => {
    expect(trendIndicator(5, 10, 20).indicator).toBe('UP_STRONG')
  })

  it('UP: +15% a +50% (100 → 120 = +20%)', () => {
    expect(trendIndicator(80, 100, 120).indicator).toBe('UP')
  })

  it('STABLE: variação dentro de ±15%', () => {
    expect(trendIndicator(100, 100, 110).indicator).toBe('STABLE') // +10%
    expect(trendIndicator(100, 100, 95).indicator).toBe('STABLE') // -5%
    expect(trendIndicator(100, 100, 100).indicator).toBe('STABLE') // 0%
  })

  it('DOWN: -15% a -50% (100 → 70 = -30%)', () => {
    expect(trendIndicator(100, 100, 70).indicator).toBe('DOWN')
  })

  it('DOWN_STRONG: caiu > -50% (100 → 30 = -70%)', () => {
    expect(trendIndicator(100, 100, 30).indicator).toBe('DOWN_STRONG')
  })

  it('Cenário Yussef: Folha 15k → 20k → 25k', () => {
    // 25k vs 20k = +25% → UP (não UP_STRONG)
    const t = trendIndicator(15000, 20000, 25000)
    expect(t.indicator).toBe('UP')
    expect(t.percentVsPrev1).toBeCloseTo(0.25, 2)
    expect(t.percentVsPrev2).toBeCloseTo(25000 / 15000 - 1, 2)
  })

  it('Limite exato 15%: stable inclui +15%', () => {
    // +15% exato → stable (limite superior incluído)
    expect(trendIndicator(0, 100, 115).indicator).toBe('STABLE')
  })

  it('Limite 50%: UP inclui +50%', () => {
    // +50% exato → UP (não UP_STRONG)
    expect(trendIndicator(0, 100, 150).indicator).toBe('UP')
  })

  it('51% → UP_STRONG', () => {
    expect(trendIndicator(0, 100, 151).indicator).toBe('UP_STRONG')
  })
})

// ─── Period helpers ────────────────────────────────────────────────────

describe('parseRefMonth', () => {
  it('parse YYYY-MM válido', () => {
    const r = parseRefMonth('2026-05')
    expect(r.ym).toBe('2026-05')
    expect(r.label).toBe('Mai/26')
    expect(r.start.toISOString()).toBe('2026-05-01T00:00:00.000Z')
    expect(r.end.toISOString()).toBe('2026-05-31T23:59:59.999Z')
  })

  it('parse fevereiro NÃO bissexto: dia 28', () => {
    expect(parseRefMonth('2025-02').end.toISOString()).toBe(
      '2025-02-28T23:59:59.999Z',
    )
  })

  it('parse fevereiro bissexto: dia 29', () => {
    expect(parseRefMonth('2024-02').end.toISOString()).toBe(
      '2024-02-29T23:59:59.999Z',
    )
  })

  it('rejeita formato inválido', () => {
    expect(() => parseRefMonth('2026/05')).toThrow()
    expect(() => parseRefMonth('05-2026')).toThrow()
    expect(() => parseRefMonth('foo')).toThrow()
  })

  it('rejeita mês fora 1-12', () => {
    expect(() => parseRefMonth('2026-13')).toThrow()
    expect(() => parseRefMonth('2026-00')).toThrow()
  })
})

describe('threeMonthsForRef', () => {
  it('Mai/26 → [Mar, Abr, Mai]', () => {
    const r = threeMonthsForRef('2026-05')
    expect(r.prev2.label).toBe('Mar/26')
    expect(r.prev1.label).toBe('Abr/26')
    expect(r.current.label).toBe('Mai/26')
  })

  it('Atravessa virada de ano: Jan/26 → [Nov/25, Dez/25, Jan/26]', () => {
    const r = threeMonthsForRef('2026-01')
    expect(r.prev2.label).toBe('Nov/25')
    expect(r.prev1.label).toBe('Dez/25')
    expect(r.current.label).toBe('Jan/26')
  })

  it('Fev/26 → [Dez/25, Jan/26, Fev/26]', () => {
    const r = threeMonthsForRef('2026-02')
    expect(r.prev2.label).toBe('Dez/25')
    expect(r.prev1.label).toBe('Jan/26')
    expect(r.current.label).toBe('Fev/26')
  })
})

// ─── computeComparativo ────────────────────────────────────────────────

function tx(
  bucketDate: string,
  amount: number,
  catId: string | null,
  catName: string,
  type: 'DEBIT' | 'CREDIT' = 'DEBIT',
): ComparativoInputTx {
  return {
    bucketDate,
    amount,
    type,
    categoryId: catId,
    categoryName: catName,
    dreGroup: null,
  }
}

describe('computeComparativo', () => {
  it('cenário REAL Yussef: Folha 15k → 20k → 25k', () => {
    const txs = [
      tx('2026-03-15', 15000, 'cat-folha', 'Salários'),
      tx('2026-04-15', 20000, 'cat-folha', 'Salários'),
      tx('2026-05-15', 25000, 'cat-folha', 'Salários'),
    ]
    const r = computeComparativo(txs, '2026-05', 'DESPESA')
    expect(r.rows).toHaveLength(1)
    const row = r.rows[0]
    expect(row.categoryName).toBe('Salários')
    expect(row.prev2).toBe(15000)
    expect(row.prev1).toBe(20000)
    expect(row.current).toBe(25000)
    expect(row.total).toBe(60000)
    expect(row.trend.indicator).toBe('UP')
  })

  it('Categoria NEW (só aparece no current month)', () => {
    const r = computeComparativo(
      [tx('2026-05-10', 4500, 'cat-marketing', 'Marketing')],
      '2026-05',
      'DESPESA',
    )
    expect(r.rows[0].trend.indicator).toBe('NEW')
  })

  it('Categoria GONE (aparece em prev1 mas não current)', () => {
    const r = computeComparativo(
      [tx('2026-04-10', 5000, 'cat-old', 'Manutenção')],
      '2026-05',
      'DESPESA',
    )
    expect(r.rows[0].trend.indicator).toBe('GONE')
  })

  it('Ordenação: maior total primeiro', () => {
    const txs = [
      tx('2026-05-01', 100, 'a', 'A'),
      tx('2026-05-01', 5000, 'b', 'B'),
      tx('2026-05-01', 1000, 'c', 'C'),
    ]
    const r = computeComparativo(txs, '2026-05', 'DESPESA')
    expect(r.rows.map((x) => x.categoryName)).toEqual(['B', 'C', 'A'])
  })

  it('Filtro DESPESA ignora CREDIT', () => {
    const r = computeComparativo(
      [
        tx('2026-05-01', 1000, 'a', 'A', 'DEBIT'),
        tx('2026-05-01', 5000, 'b', 'B', 'CREDIT'),
      ],
      '2026-05',
      'DESPESA',
    )
    expect(r.rows.map((x) => x.categoryName)).toEqual(['A'])
  })

  it('Filtro RECEITA ignora DEBIT', () => {
    const r = computeComparativo(
      [
        tx('2026-05-01', 1000, 'a', 'A', 'DEBIT'),
        tx('2026-05-01', 5000, 'b', 'B', 'CREDIT'),
      ],
      '2026-05',
      'RECEITA',
    )
    expect(r.rows.map((x) => x.categoryName)).toEqual(['B'])
  })

  it('Transações fora dos 3 meses são ignoradas', () => {
    const r = computeComparativo(
      [
        tx('2026-01-01', 9999, 'old', 'Antiga'), // muito antes
        tx('2026-07-01', 9999, 'futuro', 'Futuro'), // muito depois
        tx('2026-05-01', 100, 'now', 'Agora'),
      ],
      '2026-05',
      'DESPESA',
    )
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0].categoryName).toBe('Agora')
  })

  it('totals agrega corretamente', () => {
    const r = computeComparativo(
      [
        tx('2026-03-01', 100, 'a', 'A'),
        tx('2026-04-01', 200, 'a', 'A'),
        tx('2026-05-01', 300, 'a', 'A'),
        tx('2026-05-01', 50, 'b', 'B'),
      ],
      '2026-05',
      'DESPESA',
    )
    expect(r.totals.prev2).toBe(100)
    expect(r.totals.prev1).toBe(200)
    expect(r.totals.current).toBe(350)
    expect(r.totals.total).toBe(650)
  })

  it('Sem categoria → bucket "__sem_categoria__"', () => {
    const r = computeComparativo(
      [tx('2026-05-01', 100, null, 'whatever')],
      '2026-05',
      'DESPESA',
    )
    expect(r.rows[0].categoryId).toBeNull()
  })
})

// ─── filterRows ──────────────────────────────────────────────────────

describe('filterRows', () => {
  function row(indicator: string): import('@/lib/relatorios/comparativo').ComparativoRow {
    return {
      categoryId: 'x',
      categoryName: 'X',
      dreGroup: null,
      prev2: 0,
      prev1: 0,
      current: 0,
      total: 0,
      trend: {
        indicator: indicator as 'UP_STRONG',
        percentVsPrev1: null,
        percentVsPrev2: null,
      },
    }
  }

  const rows = [
    row('UP_STRONG'),
    row('UP'),
    row('STABLE'),
    row('DOWN'),
    row('DOWN_STRONG'),
    row('NEW'),
    row('GONE'),
  ]

  it('ALL retorna todas', () => {
    expect(filterRows(rows, 'ALL')).toHaveLength(7)
  })

  it('UP_ONLY: UP + UP_STRONG', () => {
    const r = filterRows(rows, 'UP_ONLY')
    expect(r).toHaveLength(2)
    expect(r.map((x) => x.trend.indicator)).toEqual(['UP_STRONG', 'UP'])
  })

  it('DOWN_ONLY: DOWN + DOWN_STRONG', () => {
    const r = filterRows(rows, 'DOWN_ONLY')
    expect(r.map((x) => x.trend.indicator)).toEqual(['DOWN', 'DOWN_STRONG'])
  })

  it('NEW_ONLY: só NEW', () => {
    const r = filterRows(rows, 'NEW_ONLY')
    expect(r).toHaveLength(1)
    expect(r[0].trend.indicator).toBe('NEW')
  })
})

describe('TREND_VISUAL — coerência semântica', () => {
  it('Todos os 8 indicators têm visual definido', () => {
    const all = [
      'UP_STRONG',
      'UP',
      'STABLE',
      'DOWN',
      'DOWN_STRONG',
      'NEW',
      'GONE',
      'EMPTY',
    ] as const
    for (const i of all) {
      expect(TREND_VISUAL[i]).toBeDefined()
      expect(TREND_VISUAL[i].symbol).toBeTruthy()
      expect(TREND_VISUAL[i].colorClass).toBeTruthy()
      expect(TREND_VISUAL[i].label).toBeTruthy()
    }
  })

  it('UP_STRONG é vermelho (preocupante)', () => {
    expect(TREND_VISUAL.UP_STRONG.colorClass).toMatch(/red/)
  })

  it('NEW é purple', () => {
    expect(TREND_VISUAL.NEW.colorClass).toMatch(/purple/)
  })
})
