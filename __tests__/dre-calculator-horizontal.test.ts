import { describe, it, expect } from 'vitest'
import { calculateDRE } from '../lib/dre/calculator'
import type { CategoryForDRE, TransactionForDRE } from '../lib/dre/types'

const cat = (id: string, dreGroup: string): CategoryForDRE => ({
  id, name: id, code: null, dreGroup, parentId: null, isActive: true, type: 'CREDIT',
})

const tx = (
  id: string,
  amount: number,
  categoryId: string,
  date: Date,
): TransactionForDRE => ({
  id,
  type: 'CREDIT',
  amount,
  date,
  competenceDate: date,
  paymentDate: date,
  categoryId,
})

const marcoPeriod = {
  startDate: new Date('2026-03-01'),
  endDate: new Date('2026-03-31'),
  regime: 'competence' as const,
}

describe('calculateDRE — análise horizontal (comparação)', () => {
  it('Sem comparação: deltas null', () => {
    const cats = [cat('c1', 'RECEITA_BRUTA')]
    const txs = [tx('t1', 1000, 'c1', new Date('2026-03-15'))]
    const result = calculateDRE(txs, cats, { period: marcoPeriod })

    expect(result.groups[0].horizontalDelta).toBe(null)
    expect(result.groups[0].horizontalPct).toBe(null)
  })

  it('Comparação previous_period: delta absoluto e %', () => {
    const cats = [cat('c1', 'RECEITA_BRUTA')]
    const txs = [
      tx('t1', 1000, 'c1', new Date('2026-03-15')),  // MAR (atual)
      tx('t2', 800, 'c1', new Date('2026-02-15')),   // FEV (anterior)
    ]
    const result = calculateDRE(txs, cats, {
      period: marcoPeriod,
      comparison: { type: 'previous_period' },
    })

    expect(result.groups[0].horizontalDelta).toBe(200)
    expect(result.groups[0].horizontalPct).toBe(25)  // 200/800 = 25%
  })

  it('Crescimento de 100%', () => {
    const cats = [cat('c1', 'RECEITA_BRUTA')]
    const txs = [
      tx('t1', 2000, 'c1', new Date('2026-03-15')),
      tx('t2', 1000, 'c1', new Date('2026-02-15')),
    ]
    const result = calculateDRE(txs, cats, {
      period: marcoPeriod,
      comparison: { type: 'previous_period' },
    })

    expect(result.groups[0].horizontalPct).toBe(100)
  })

  it('Queda de 50%', () => {
    const cats = [cat('c1', 'RECEITA_BRUTA')]
    const txs = [
      tx('t1', 500, 'c1', new Date('2026-03-15')),
      tx('t2', 1000, 'c1', new Date('2026-02-15')),
    ]
    const result = calculateDRE(txs, cats, {
      period: marcoPeriod,
      comparison: { type: 'previous_period' },
    })

    expect(result.groups[0].horizontalPct).toBe(-50)
  })

  it('Período anterior zero: pct null, delta = total atual', () => {
    const cats = [cat('c1', 'RECEITA_BRUTA')]
    const txs = [tx('t1', 1000, 'c1', new Date('2026-03-15'))]
    const result = calculateDRE(txs, cats, {
      period: marcoPeriod,
      comparison: { type: 'previous_period' },
    })

    // Comparison não tem grupo correspondente (não há txs em fev) → delta null
    expect(result.groups[0].horizontalDelta).toBe(null)
    expect(result.groups[0].horizontalPct).toBe(null)
  })

  it('totalsComparison populado quando há comparação', () => {
    const cats = [cat('c1', 'RECEITA_BRUTA')]
    const txs = [
      tx('t1', 1000, 'c1', new Date('2026-03-15')),
      tx('t2', 800, 'c1', new Date('2026-02-15')),
    ]
    const result = calculateDRE(txs, cats, {
      period: marcoPeriod,
      comparison: { type: 'previous_period' },
    })

    expect(result.totalsComparison.receitaLiquidaDelta).toBe(200)
    expect(result.totalsComparison.receitaLiquidaPct).toBe(25)
  })

  it('totalsComparison é null/zerado quando NÃO há comparação', () => {
    const cats = [cat('c1', 'RECEITA_BRUTA')]
    const txs = [tx('t1', 1000, 'c1', new Date('2026-03-15'))]
    const result = calculateDRE(txs, cats, { period: marcoPeriod })

    expect(result.totalsComparison.receitaLiquidaDelta).toBe(null)
    expect(result.totalsComparison.receitaLiquidaPct).toBe(null)
    expect(result.totalsComparison.lucroLiquidoDelta).toBe(null)
    expect(result.totalsComparison.margemLiquidaDelta).toBe(null)
  })

  it('same_period_last_year: compara mar/2026 com mar/2025', () => {
    const cats = [cat('c1', 'RECEITA_BRUTA')]
    const txs = [
      tx('t1', 1000, 'c1', new Date('2026-03-15')),
      tx('t2', 600, 'c1', new Date('2025-03-15')),
    ]
    const result = calculateDRE(txs, cats, {
      period: marcoPeriod,
      comparison: { type: 'same_period_last_year' },
    })

    expect(result.groups[0].horizontalDelta).toBe(400)
    expect(result.groups[0].horizontalPct).toBeCloseTo(66.67, 1)
  })

  it('comparisonPeriod populado no resultado', () => {
    const cats = [cat('c1', 'RECEITA_BRUTA')]
    const txs = [tx('t1', 1000, 'c1', new Date('2026-03-15'))]
    const result = calculateDRE(txs, cats, {
      period: marcoPeriod,
      comparison: { type: 'previous_period' },
    })

    expect(result.comparisonPeriod).not.toBeNull()
    expect(result.comparisonPeriod!.regime).toBe('competence')
  })

  it('Categorias dentro do grupo recebem delta horizontal', () => {
    const cats = [cat('c1', 'RECEITA_BRUTA')]
    const txs = [
      tx('t1', 1000, 'c1', new Date('2026-03-15')),
      tx('t2', 700, 'c1', new Date('2026-02-15')),
    ]
    const result = calculateDRE(txs, cats, {
      period: marcoPeriod,
      comparison: { type: 'previous_period' },
    })

    const item = result.groups[0].categories[0]
    expect(item.horizontalDelta).toBe(300)
    expect(item.horizontalPct).toBeCloseTo(42.857, 2)
  })

  it('comparison custom: usa período fornecido', () => {
    const cats = [cat('c1', 'RECEITA_BRUTA')]
    const txs = [
      tx('t1', 1000, 'c1', new Date('2026-03-15')),
      tx('t2', 500, 'c1', new Date('2025-12-15')),
    ]
    const result = calculateDRE(txs, cats, {
      period: marcoPeriod,
      comparison: {
        type: 'custom',
        period: {
          startDate: new Date('2025-12-01'),
          endDate: new Date('2025-12-31'),
          regime: 'competence',
        },
      },
    })

    expect(result.comparisonPeriod).not.toBeNull()
    expect(result.groups[0].horizontalDelta).toBe(500)
  })
})
