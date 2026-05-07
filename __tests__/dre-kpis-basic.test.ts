import { describe, it, expect } from 'vitest'
import { calculateKPIs } from '../lib/dre/kpis'
import type { DREResult, DRETotals } from '../lib/dre/types'

// Totais alinhados ao schema oficial DRETotals (5.4.A): inclui todos os campos
// granulares (totalOutrasReceitas, totalDespesas{Pessoal,Comerciais,Admin,Outras},
// receitas/despesas Financeiras, impostosSobreLucro etc).
const baseTotals: DRETotals = {
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
  despesasFinanceiras: 1000,
  resultadoFinanceiro: -1000,
  lair: 24000,
  impostosSobreLucro: 4000,
  lucroLiquido: 20000,
  margemBruta: 66.67,
  margemOperacional: 27.78,
  margemLiquida: 22.22,
}

const baseDRE: DREResult = {
  period: {
    startDate: new Date('2026-03-01'),
    endDate: new Date('2026-03-31'),
    regime: 'competence',
  },
  comparisonPeriod: null,
  groups: [],
  totals: baseTotals,
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

describe('calculateKPIs — básico', () => {
  it('Receita Líquida correta', () => {
    const k = calculateKPIs(baseDRE)
    expect(k.receitaLiquida.value).toBe(90000)
  })

  it('Lucro Líquido correto', () => {
    const k = calculateKPIs(baseDRE)
    expect(k.lucroLiquido.value).toBe(20000)
  })

  it('EBITDA = Resultado Operacional', () => {
    const k = calculateKPIs(baseDRE)
    expect(k.ebitda.value).toBe(25000)
  })

  it('Margem Líquida = lucro/receita líquida', () => {
    const k = calculateKPIs(baseDRE)
    expect(k.margemLiquida.value).toBeCloseTo(22.22, 2)
  })

  it('Carga Tributária = (deduções + IRPJ/CSLL) / receita bruta', () => {
    const k = calculateKPIs(baseDRE)
    // (10000 + 4000) / 100000 = 14%
    expect(k.cargaTributaria.value).toBeCloseTo(14, 1)
  })

  it('Despesa Pessoal correta', () => {
    const k = calculateKPIs(baseDRE)
    expect(k.despesaPessoal.value).toBe(20000)
  })

  it('% Pessoal sobre receita líquida', () => {
    const k = calculateKPIs(baseDRE)
    // 20000/90000 ≈ 22.22%
    expect(k.despesaPessoalPct.value).toBeCloseTo(22.22, 2)
  })

  it('Despesas Operacionais Total', () => {
    const k = calculateKPIs(baseDRE)
    expect(k.despesasOperacionaisTotal.value).toBe(35000)
  })

  it('Receita Bruta zero: Carga Tributária null', () => {
    const dre = { ...baseDRE, totals: { ...baseTotals, receitaBruta: 0 } }
    const k = calculateKPIs(dre)
    expect(k.cargaTributaria.value).toBe(null)
  })

  it('Receita Líquida zero: %Pessoal null', () => {
    const dre = { ...baseDRE, totals: { ...baseTotals, receitaLiquida: 0 } }
    const k = calculateKPIs(dre)
    expect(k.despesaPessoalPct.value).toBe(null)
  })

  it('Resultado Financeiro negativo gera warning', () => {
    const k = calculateKPIs(baseDRE)
    expect(k.resultadoFinanceiro.warning).toBe('Resultado financeiro negativo')
  })

  it('Lucro Líquido negativo gera warning de prejuízo', () => {
    const dre = { ...baseDRE, totals: { ...baseTotals, lucroLiquido: -5000 } }
    const k = calculateKPIs(dre)
    expect(k.lucroLiquido.warning).toBe('Prejuízo no período')
  })

  it('Crescimento Receita reflete receitaLiquidaPct da comparação', () => {
    const dre = {
      ...baseDRE,
      totalsComparison: { ...baseDRE.totalsComparison, receitaLiquidaPct: 15.5 },
    }
    const k = calculateKPIs(dre)
    expect(k.crescimentoReceita.value).toBeCloseTo(15.5, 2)
  })
})
