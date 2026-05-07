import { describe, it, expect } from 'vitest'
import { calculateKPIs } from '../lib/dre/kpis'
import type { DREResult, DRETotals } from '../lib/dre/types'

function makeDRE(overrides: Partial<DRETotals> = {}): DREResult {
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
      ...overrides,
    },
    nonDreGroups: [],
    uncategorized: { total: 0, transactionCount: 0 },
    totalsComparison: {
      receitaLiquidaDelta: null,
      receitaLiquidaPct: null,
      lucroLiquidoDelta: null,
      lucroLiquidoPct: null,
      margemLiquidaDelta: null,
    },
    metadata: {
      transactionsProcessed: 100,
      categoriesUsed: 10,
      calculatedAt: new Date(),
    },
  }
}

describe('calculateKPIs — warnings', () => {
  it('Margem líquida < 5% gera warning', () => {
    const k = calculateKPIs(makeDRE({ margemLiquida: 3 }))
    expect(k.margemLiquida.warning).toBe('Margem abaixo de 5%')
  })

  it('Margem líquida >= 5% sem warning', () => {
    const k = calculateKPIs(makeDRE({ margemLiquida: 5 }))
    expect(k.margemLiquida.warning).toBeUndefined()
  })

  it('Margem bruta < 30% gera warning', () => {
    const k = calculateKPIs(makeDRE({ margemBruta: 25 }))
    expect(k.margemBruta.warning).toBe('Margem bruta baixa')
  })

  it('Margem bruta zero (sem receita) NÃO gera warning de "baixa"', () => {
    const k = calculateKPIs(makeDRE({ margemBruta: 0 }))
    expect(k.margemBruta.warning).toBeUndefined()
  })

  it('Carga Tributária > 25% gera warning', () => {
    const k = calculateKPIs(
      makeDRE({ totalDeducoes: 25000, impostosSobreLucro: 5000 }),
    )
    // (25000 + 5000) / 100000 = 30%
    expect(k.cargaTributaria.warning).toBe('Tributação alta')
  })

  it('Carga Tributária <= 25% sem warning', () => {
    const k = calculateKPIs(
      makeDRE({ totalDeducoes: 15000, impostosSobreLucro: 5000 }),
    )
    // 20%
    expect(k.cargaTributaria.warning).toBeUndefined()
  })

  it('% Pessoal > 45% gera warning', () => {
    const k = calculateKPIs(makeDRE({ totalDespesasPessoal: 45000 }))
    // 45000/90000 ≈ 50%
    expect(k.despesaPessoalPct.warning).toBe('Folha alta (>45%)')
  })

  it('% Pessoal <= 45% sem warning', () => {
    const k = calculateKPIs(makeDRE({ totalDespesasPessoal: 35000 }))
    // 35000/90000 ≈ 38.9%
    expect(k.despesaPessoalPct.warning).toBeUndefined()
  })

  it('Margem negativa não gera "abaixo de 5%" (já é prejuízo)', () => {
    const k = calculateKPIs(makeDRE({ margemLiquida: -2 }))
    expect(k.margemLiquida.warning).toBeUndefined()
  })

  it('Resultado Financeiro positivo NÃO gera warning', () => {
    const k = calculateKPIs(makeDRE({ resultadoFinanceiro: 500 }))
    expect(k.resultadoFinanceiro.warning).toBeUndefined()
  })
})
