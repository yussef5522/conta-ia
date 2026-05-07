import { describe, it, expect } from 'vitest'
import { calculateKPIs, getVariationColor } from '../lib/dre/kpis'
import type { DREResult, DRETotals } from '../lib/dre/types'

function makeDRE(
  totalsOverride: Partial<DRETotals> = {},
  comparisonOverride: Partial<DREResult['totalsComparison']> = {},
): DREResult {
  return {
    period: {
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-03-31'),
      regime: 'competence',
    },
    comparisonPeriod: null,
    groups: [],
    totals: {
      receitaBruta: 100000,
      totalDeducoes: 10000,
      receitaLiquida: 90000,
      totalCustos: 30000,
      lucroBruto: 60000,
      totalOutrasReceitas: 0,
      totalDespesasPessoal: 20000,
      totalDespesasComerciais: 10000,
      totalDespesasAdministrativas: 5000,
      totalOutrasDespesas: 0,
      totalDespesasOperacionais: 35000,
      resultadoOperacional: 25000,
      receitasFinanceiras: 0,
      despesasFinanceiras: 0,
      resultadoFinanceiro: 0,
      lair: 25000,
      impostosSobreLucro: 4000,
      lucroLiquido: 21000,
      margemBruta: 66.67,
      margemOperacional: 27.78,
      margemLiquida: 23.33,
      ...totalsOverride,
    },
    nonDreGroups: [],
    uncategorized: { total: 0, transactionCount: 0 },
    totalsComparison: {
      receitaLiquidaDelta: null,
      receitaLiquidaPct: 10, // crescimento positivo default
      lucroLiquidoDelta: null,
      lucroLiquidoPct: null,
      margemLiquidaDelta: null,
      ...comparisonOverride,
    },
    metadata: {
      transactionsProcessed: 100,
      categoriesUsed: 10,
      calculatedAt: new Date(),
    },
  }
}

describe('Saúde Financeira — status', () => {
  it('SAUDÁVEL: lucro positivo + margem ≥ 5% + crescimento ≥ 0', () => {
    const k = calculateKPIs(makeDRE())
    expect(k.health.status).toBe('HEALTHY')
  })

  it('ALERTA: prejuízo (lucro líquido < 0)', () => {
    const k = calculateKPIs(makeDRE({ lucroLiquido: -5000, margemLiquida: -5.5 }))
    expect(k.health.status).toBe('ALERT')
  })

  it('ATENÇÃO: lucro positivo mas margem < 5%', () => {
    const k = calculateKPIs(makeDRE({ lucroLiquido: 1000, margemLiquida: 1 }))
    expect(k.health.status).toBe('ATTENTION')
  })

  it('ATENÇÃO: lucro positivo + margem ok mas crescimento negativo', () => {
    const k = calculateKPIs(makeDRE({}, { receitaLiquidaPct: -10 }))
    expect(k.health.status).toBe('ATTENTION')
  })
})

describe('Saúde Financeira — score', () => {
  it('Score sempre entre 0 e 100', () => {
    const saudavel = calculateKPIs(makeDRE())
    const ruim = calculateKPIs(
      makeDRE({ lucroLiquido: -10000, margemLiquida: -11 }),
    )

    expect(saudavel.health.score).toBeGreaterThanOrEqual(0)
    expect(saudavel.health.score).toBeLessThanOrEqual(100)
    expect(ruim.health.score).toBeGreaterThanOrEqual(0)
    expect(ruim.health.score).toBeLessThanOrEqual(100)
  })

  it('Saudável tem score maior que prejuízo', () => {
    const s = calculateKPIs(makeDRE()).health.score
    const r = calculateKPIs(
      makeDRE({ lucroLiquido: -10000, margemLiquida: -11 }),
    ).health.score
    expect(s).toBeGreaterThan(r)
  })
})

describe('Saúde Financeira — narrativas', () => {
  it('positives populado quando há aspectos positivos', () => {
    const k = calculateKPIs(makeDRE())
    expect(k.health.positives.length).toBeGreaterThan(0)
  })

  it('attentions populado quando há aspectos negativos', () => {
    const k = calculateKPIs(
      makeDRE({ lucroLiquido: -1000, margemLiquida: -1.1 }),
    )
    expect(k.health.attentions.length).toBeGreaterThan(0)
  })

  it('Margem bruta saudável aparece em positives', () => {
    const k = calculateKPIs(makeDRE())
    expect(k.health.positives.some((p) => p.toLowerCase().includes('bruta'))).toBe(
      true,
    )
  })
})

describe('getVariationColor', () => {
  it('revenue ↑ = positive', () => {
    expect(getVariationColor('revenue', 5)).toBe('positive')
  })

  it('revenue ↓ = negative', () => {
    expect(getVariationColor('revenue', -3)).toBe('negative')
  })

  it('expense ↑ = negative (gastou mais)', () => {
    expect(getVariationColor('expense', 8)).toBe('negative')
  })

  it('expense ↓ = positive (gastou menos)', () => {
    expect(getVariationColor('expense', -5)).toBe('positive')
  })

  it('null ou zero = neutral', () => {
    expect(getVariationColor('revenue', null)).toBe('neutral')
    expect(getVariationColor('revenue', 0)).toBe('neutral')
  })
})
