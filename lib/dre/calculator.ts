// Engine PURO de cálculo de DRE (Sub-etapa 5.4.A).
// Sem dependências de DB. Recebe dados, retorna estrutura DRE completa.

import type {
  TransactionForDRE,
  CategoryForDRE,
  CalculateDREOptions,
  DREResult,
  DREGroupResult,
  DRECategoryItem,
  DREGroup,
  DRETotals,
  DREPeriod,
  NonDREGroupResult,
  NonDREGroup,
} from './types'
import {
  DRE_GROUP_ORDER,
  DRE_GROUP_LABELS,
  DRE_GROUP_SIGN,
  DRE_GROUP_SET,
  NON_DRE_GROUPS,
  NON_DRE_GROUP_LABELS,
  NON_DRE_GROUP_SET,
} from './types'
import { calculateComparisonPeriod, isValidPeriod } from './period'

// ============================================================
// Função principal
// ============================================================

export function calculateDRE(
  transactions: TransactionForDRE[],
  categories: CategoryForDRE[],
  options: CalculateDREOptions,
): DREResult {
  if (!isValidPeriod(options.period)) {
    throw new Error('Período inválido: startDate > endDate ou data inválida')
  }

  // 1. Determina período de comparação
  let comparisonPeriod: DREPeriod | null = null
  if (options.comparison) {
    if (options.comparison.type === 'custom') {
      // Custom: usa o período fornecido pelo caller (já validado)
      if (options.comparison.period && isValidPeriod(options.comparison.period)) {
        comparisonPeriod = options.comparison.period
      }
    } else if (options.comparison.type !== 'none') {
      comparisonPeriod = calculateComparisonPeriod(
        options.period,
        options.comparison.type,
      )
    }
  }

  // 2. Filtra transações pelo período + regime
  const txCurrent = filterTransactionsByPeriod(transactions, options.period)
  const txComparison = comparisonPeriod
    ? filterTransactionsByPeriod(transactions, comparisonPeriod)
    : []

  // 3. Calcula DRE atual e (se aplicável) DRE de comparação
  const currentResult = calculateForPeriod(txCurrent, categories)
  const comparisonResult = comparisonPeriod
    ? calculateForPeriod(txComparison, categories)
    : null

  // 4. Aplica análise horizontal (compara current vs comparison)
  applyHorizontalAnalysis(currentResult, comparisonResult)

  // 5. Aplica análise vertical (% sobre Receita Líquida)
  applyVerticalAnalysis(currentResult)

  // 6. Calcula totais agregados
  const totals = calculateTotals(currentResult.groups)

  // 7. Análise horizontal dos totais
  const totalsComparison = comparisonResult
    ? calculateTotalsComparison(totals, calculateTotals(comparisonResult.groups))
    : {
        receitaLiquidaDelta: null,
        receitaLiquidaPct: null,
        lucroLiquidoDelta: null,
        lucroLiquidoPct: null,
        margemLiquidaDelta: null,
      }

  return {
    period: options.period,
    comparisonPeriod,
    groups: currentResult.groups,
    totals,
    nonDreGroups: currentResult.nonDreGroups,
    uncategorized: currentResult.uncategorized,
    totalsComparison,
    metadata: {
      transactionsProcessed: txCurrent.length,
      categoriesUsed: countCategoriesUsed(currentResult.groups),
      calculatedAt: new Date(),
    },
  }
}

// ============================================================
// Filtra transações por período + regime
// ============================================================
//
// Regime competência: usa competenceDate (com fallback pra date se ausente).
// Regime caixa: usa paymentDate, COM fallback pra date (Yussef 11/06/2026).
// Motivo do fallback caixa: OFX importadas não recebem paymentDate, mas seu `date`
// é exatamente a data da operação bancária = significado de regime caixa.

function filterTransactionsByPeriod(
  transactions: TransactionForDRE[],
  period: DREPeriod,
): TransactionForDRE[] {
  const startMs = period.startDate.getTime()
  const endMs = period.endDate.getTime()

  return transactions.filter((tx) => {
    let date: Date | null
    if (period.regime === 'competence') {
      date = tx.competenceDate ?? tx.date ?? null
    } else {
      date = tx.paymentDate ?? tx.date ?? null
    }

    if (!date) return false

    const dateMs = new Date(date).getTime()
    if (isNaN(dateMs)) return false
    return dateMs >= startMs && dateMs <= endMs
  })
}

// ============================================================
// Calcula DRE pra um período (sem comparação ainda)
// ============================================================

interface PeriodResult {
  groups: DREGroupResult[]
  nonDreGroups: NonDREGroupResult[]
  uncategorized: { total: number; transactionCount: number }
}

function calculateForPeriod(
  transactions: TransactionForDRE[],
  categories: CategoryForDRE[],
): PeriodResult {
  // Index categorias por ID
  const catById = new Map<string, CategoryForDRE>()
  for (const c of categories) catById.set(c.id, c)

  // Buckets:
  //   - byDreGroup: agrega por DREGroup → catId
  //   - byNonDreGroup: agrega por NonDREGroup
  //   - uncat: sem categoria, sem dreGroup, ou dreGroup desconhecido
  const byDreGroup: Map<string, Map<string, { total: number; count: number }>> = new Map()
  const byNonDreGroup: Map<NonDREGroup, { total: number; count: number }> = new Map()
  let uncatTotal = 0
  let uncatCount = 0

  for (const tx of transactions) {
    // Transferências entre contas da mesma empresa não compõem DRE (Sprint 0.5).
    // Defesa em profundidade: a rota /api/empresas/[id]/dre já filtra no SQL,
    // mas o engine puro também ignora pra casos de uso futuros (testes, batch).
    if (tx.type === 'TRANSFER') continue

    if (!tx.categoryId) {
      uncatTotal += tx.amount
      uncatCount++
      continue
    }

    const cat = catById.get(tx.categoryId)
    if (!cat) {
      uncatTotal += tx.amount
      uncatCount++
      continue
    }

    const dreGroup = cat.dreGroup
    if (!dreGroup) {
      uncatTotal += tx.amount
      uncatCount++
      continue
    }

    if (DRE_GROUP_SET.has(dreGroup)) {
      if (!byDreGroup.has(dreGroup)) byDreGroup.set(dreGroup, new Map())
      const groupMap = byDreGroup.get(dreGroup)!
      const existing = groupMap.get(tx.categoryId) ?? { total: 0, count: 0 }
      existing.total += tx.amount
      existing.count++
      groupMap.set(tx.categoryId, existing)
    } else if (NON_DRE_GROUP_SET.has(dreGroup)) {
      const key = dreGroup as NonDREGroup
      const existing = byNonDreGroup.get(key) ?? { total: 0, count: 0 }
      existing.total += tx.amount
      existing.count++
      byNonDreGroup.set(key, existing)
    } else {
      // dreGroup desconhecido (string fora do enum) — vai pra uncategorized
      uncatTotal += tx.amount
      uncatCount++
    }
  }

  // Constrói grupos DRE na ORDEM oficial
  const groups: DREGroupResult[] = []

  for (const groupKey of DRE_GROUP_ORDER) {
    const groupMap = byDreGroup.get(groupKey)
    if (!groupMap || groupMap.size === 0) continue

    const items: DRECategoryItem[] = []
    let groupTotal = 0

    for (const [catId, data] of groupMap.entries()) {
      const cat = catById.get(catId)
      if (!cat) continue

      items.push({
        category: { id: cat.id, name: cat.name, code: cat.code },
        total: data.total,
        transactionCount: data.count,
        verticalPct: null,
        horizontalDelta: null,
        horizontalPct: null,
        children: [],  // hierarquia em v2
      })

      groupTotal += data.total
    }

    // Ordena items por nome (PT-BR)
    items.sort((a, b) => a.category.name.localeCompare(b.category.name, 'pt-BR'))

    groups.push({
      group: groupKey,
      groupLabel: DRE_GROUP_LABELS[groupKey],
      sign: DRE_GROUP_SIGN[groupKey],
      categories: items,
      total: groupTotal,
      verticalPct: null,
      horizontalDelta: null,
      horizontalPct: null,
    })
  }

  // Constrói grupos não-DRE na ordem definida em NON_DRE_GROUPS
  const nonDreGroups: NonDREGroupResult[] = []
  for (const key of NON_DRE_GROUPS) {
    const data = byNonDreGroup.get(key)
    if (!data || data.count === 0) continue
    nonDreGroups.push({
      group: key,
      groupLabel: NON_DRE_GROUP_LABELS[key],
      total: data.total,
      transactionCount: data.count,
    })
  }

  return {
    groups,
    nonDreGroups,
    uncategorized: { total: uncatTotal, transactionCount: uncatCount },
  }
}

// ============================================================
// Aplica análise horizontal (comparação)
// ============================================================

function applyHorizontalAnalysis(
  current: PeriodResult,
  comparison: PeriodResult | null,
): void {
  if (!comparison) return

  // Index grupos comparison por DREGroup
  const compGroupById = new Map<string, DREGroupResult>()
  for (const g of comparison.groups) compGroupById.set(g.group, g)

  for (const group of current.groups) {
    const compGroup = compGroupById.get(group.group)

    if (compGroup) {
      group.horizontalDelta = group.total - compGroup.total
      group.horizontalPct =
        compGroup.total !== 0
          ? ((group.total - compGroup.total) / Math.abs(compGroup.total)) * 100
          : null

      // Aplica em cada categoria do grupo
      const compCatById = new Map<string, DRECategoryItem>()
      for (const c of compGroup.categories) compCatById.set(c.category.id, c)

      for (const cat of group.categories) {
        const compCat = compCatById.get(cat.category.id)
        if (compCat) {
          cat.horizontalDelta = cat.total - compCat.total
          cat.horizontalPct =
            compCat.total !== 0
              ? ((cat.total - compCat.total) / Math.abs(compCat.total)) * 100
              : null
        }
        // Sem match no comparison: deltas ficam null (já default)
      }
    }
    // Sem match no comparison: deltas ficam null (já default)
  }
}

// ============================================================
// Aplica análise vertical (% sobre Receita Líquida)
// ============================================================

function applyVerticalAnalysis(current: PeriodResult): void {
  const receitaBruta = sumGroupsByName(current.groups, ['RECEITA_BRUTA'])
  const deducoes = sumGroupsByName(current.groups, ['DEDUCOES'])
  const receitaLiquida = receitaBruta - deducoes

  if (receitaLiquida === 0) return

  for (const group of current.groups) {
    group.verticalPct = (group.total / receitaLiquida) * 100

    for (const cat of group.categories) {
      cat.verticalPct = (cat.total / receitaLiquida) * 100
    }
  }
}

function sumGroupsByName(groups: DREGroupResult[], names: string[]): number {
  return groups
    .filter((g) => names.includes(g.group))
    .reduce((sum, g) => sum + g.total, 0)
}

// ============================================================
// Calcula totais agregados (estrutura DRE oficial)
// ============================================================

function calculateTotals(groups: DREGroupResult[]): DRETotals {
  const sum = (names: DREGroup[]): number =>
    groups.filter((g) => names.includes(g.group)).reduce((s, g) => s + g.total, 0)

  const receitaBruta = sum(['RECEITA_BRUTA'])
  const totalDeducoes = sum(['DEDUCOES'])
  const receitaLiquida = receitaBruta - totalDeducoes

  const totalCustos = sum(['CUSTO_PRODUTO_VENDIDO'])
  const lucroBruto = receitaLiquida - totalCustos

  const totalOutrasReceitas = sum(['OUTRAS_RECEITAS'])
  const totalDespesasPessoal = sum(['DESPESAS_PESSOAL'])
  const totalDespesasComerciais = sum(['DESPESAS_COMERCIAIS'])
  const totalDespesasAdministrativas = sum(['DESPESAS_ADMINISTRATIVAS'])
  const totalOutrasDespesas = sum(['OUTRAS_DESPESAS'])
  const totalDespesasOperacionais =
    totalDespesasPessoal +
    totalDespesasComerciais +
    totalDespesasAdministrativas +
    totalOutrasDespesas

  const resultadoOperacional =
    lucroBruto + totalOutrasReceitas - totalDespesasOperacionais

  const receitasFinanceiras = sum(['RECEITAS_FINANCEIRAS'])
  const despesasFinanceiras = sum(['DESPESAS_FINANCEIRAS'])
  const resultadoFinanceiro = receitasFinanceiras - despesasFinanceiras

  const lair = resultadoOperacional + resultadoFinanceiro
  const impostosSobreLucro = sum(['IMPOSTOS_SOBRE_LUCRO'])
  const lucroLiquido = lair - impostosSobreLucro

  // Margens (% sobre Receita Líquida; 0 quando RL = 0 pra evitar NaN)
  const margemBruta =
    receitaLiquida !== 0 ? (lucroBruto / receitaLiquida) * 100 : 0
  const margemOperacional =
    receitaLiquida !== 0 ? (resultadoOperacional / receitaLiquida) * 100 : 0
  const margemLiquida =
    receitaLiquida !== 0 ? (lucroLiquido / receitaLiquida) * 100 : 0

  return {
    receitaBruta,
    totalDeducoes,
    receitaLiquida,
    totalCustos,
    lucroBruto,
    totalOutrasReceitas,
    totalDespesasPessoal,
    totalDespesasComerciais,
    totalDespesasAdministrativas,
    totalOutrasDespesas,
    totalDespesasOperacionais,
    resultadoOperacional,
    receitasFinanceiras,
    despesasFinanceiras,
    resultadoFinanceiro,
    lair,
    impostosSobreLucro,
    lucroLiquido,
    margemBruta,
    margemOperacional,
    margemLiquida,
  }
}

// ============================================================
// Comparação dos totais
// ============================================================

function calculateTotalsComparison(
  current: DRETotals,
  prev: DRETotals,
): DREResult['totalsComparison'] {
  return {
    receitaLiquidaDelta: current.receitaLiquida - prev.receitaLiquida,
    receitaLiquidaPct:
      prev.receitaLiquida !== 0
        ? ((current.receitaLiquida - prev.receitaLiquida) /
            Math.abs(prev.receitaLiquida)) *
          100
        : null,
    lucroLiquidoDelta: current.lucroLiquido - prev.lucroLiquido,
    lucroLiquidoPct:
      prev.lucroLiquido !== 0
        ? ((current.lucroLiquido - prev.lucroLiquido) /
            Math.abs(prev.lucroLiquido)) *
          100
        : null,
    margemLiquidaDelta: current.margemLiquida - prev.margemLiquida,
  }
}

function countCategoriesUsed(groups: DREGroupResult[]): number {
  return groups.reduce((sum, g) => sum + g.categories.length, 0)
}
