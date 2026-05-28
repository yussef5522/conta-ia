// Hotfix 5.0.4.0c1-fix — Orquestrador da coleta de dados pro prompt da IA.
//
// REFATORADO: 3 sub-funções por modo + dispatcher.
//
// Reusa engines existentes (calculateDRE, collectVariances) e adiciona
// lógica nova pra evolution (snapshots mensais + emerging/disappeared).

import { prisma } from '@/lib/db'
import { calculateDRE } from '@/lib/dre/calculator'
import { collectVariances } from '@/lib/variance/collect'
import type { CategoryForDRE, TransactionForDRE } from '@/lib/dre/types'
import {
  parsePeriodInput,
  addMonthsUTC,
  startOfMonthUTC,
  endOfMonthUTC,
  inferMode,
  type InsightMode,
} from '@/lib/dates/period-presets'
import type {
  InsightInputData,
  ComparativeInputData,
  EvolutionInputData,
  SingleInputData,
  InsightMonthlySnapshot,
  InsightEmergingCategory,
  InsightDisappearedCategory,
  InsightTopCategoryEvolution,
  InsightCategorySnapshot,
} from './insights-types'

const MES_FULL = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

function labelMonth(d: Date): string {
  return `${MES_FULL[d.getUTCMonth()]}/${d.getUTCFullYear()}`
}

function labelPeriod(start: Date, end: Date): string {
  // "1 de Maio a 31 de Maio de 2026"
  const sd = start.getUTCDate()
  const sm = MES_FULL[start.getUTCMonth()]
  const sy = start.getUTCFullYear()
  const ed = end.getUTCDate()
  const em = MES_FULL[end.getUTCMonth()]
  const ey = end.getUTCFullYear()
  if (sy === ey && sm === em) {
    return `${sd} a ${ed} de ${em} de ${sy}`
  }
  if (sy === ey) {
    return `${sd} de ${sm} a ${ed} de ${em} de ${sy}`
  }
  return `${sd} de ${sm} de ${sy} a ${ed} de ${em} de ${ey}`
}

export interface CollectInsightDataParams {
  empresaId: string
  /** YYYY-MM-DD */
  startDate: string
  endDate: string
  compareStartDate?: string
  compareEndDate?: string
}

export async function collectInsightData(
  params: CollectInsightDataParams,
): Promise<InsightInputData> {
  if (!params.empresaId) {
    throw new Error('empresaId obrigatório (multi-tenant)')
  }

  const mode = inferMode({
    startDate: params.startDate,
    endDate: params.endDate,
    compareStartDate: params.compareStartDate,
    compareEndDate: params.compareEndDate,
  })

  switch (mode) {
    case 'comparative':
      return collectComparative(params)
    case 'evolution':
      return collectEvolution(params)
    case 'single':
      return collectSingle(params)
  }
}

// ============================================================
// Modo COMPARATIVE — 2 períodos + variâncias
// ============================================================

async function collectComparative(
  params: CollectInsightDataParams,
): Promise<ComparativeInputData> {
  const { empresaId } = params
  if (!params.compareStartDate || !params.compareEndDate) {
    throw new Error('compareStartDate/compareEndDate obrigatórios em comparative')
  }

  const curStart = parsePeriodInput(params.startDate)
  const curEnd = endOfMonthUTC(parsePeriodInput(params.endDate))
  const baseStart = parsePeriodInput(params.compareStartDate)
  const baseEnd = endOfMonthUTC(parsePeriodInput(params.compareEndDate))

  const empresa = await prisma.company.findUnique({
    where: { id: empresaId },
    select: { name: true, tradeName: true },
  })
  if (!empresa) throw new Error('Empresa não encontrada')

  const multiTenantOR = buildMultiTenantOR(empresaId)
  const rangeStart = curStart < baseStart ? curStart : baseStart
  const rangeEnd = curEnd > baseEnd ? curEnd : baseEnd

  const [categoriesRaw, txAllRaw, variancesResult, topGroupedCurrent] =
    await Promise.all([
      prisma.category.findMany({
        where: { companyId: empresaId },
        select: dreCategorySelect(),
      }),
      prisma.transaction.findMany({
        where: {
          lifecycle: 'EFFECTED',
          reconciledWithId: null,
          AND: [
            { OR: multiTenantOR },
            {
              OR: [
                { competenceDate: { gte: rangeStart, lte: rangeEnd } },
                {
                  competenceDate: null,
                  date: { gte: rangeStart, lte: rangeEnd },
                },
              ],
            },
          ],
        },
        select: txDRESelect(),
      }),
      // Variâncias só aceita YYYY-MM (legacy) — adapta o input
      collectVariancesForDateRange(empresaId, curStart, baseStart),
      prisma.transaction.groupBy({
        by: ['categoryId'],
        where: {
          OR: multiTenantOR,
          lifecycle: 'EFFECTED',
          reconciledWithId: null,
          type: 'DEBIT',
          categoryId: { not: null },
          paymentDate: { gte: curStart, lte: curEnd, not: null },
        },
        _sum: { amount: true },
        orderBy: { _sum: { amount: 'desc' } },
        take: 10,
      }),
    ])

  const categories = mapCategories(categoriesRaw)
  const txCurrent = filterMapTxs(txAllRaw, curStart, curEnd)
  const txBase = filterMapTxs(txAllRaw, baseStart, baseEnd)

  const dreCurrent = calculateDRE(txCurrent, categories, {
    period: { startDate: curStart, endDate: curEnd, regime: 'competence' },
  })
  const dreBase = calculateDRE(txBase, categories, {
    period: { startDate: baseStart, endDate: baseEnd, regime: 'competence' },
  })

  const topCategoriesCurrent = await buildTopCategoriesSnapshot(
    empresaId,
    topGroupedCurrent,
  )

  return {
    mode: 'comparative',
    empresaId,
    empresaName: empresa.tradeName ?? empresa.name,
    startDate: params.startDate,
    endDate: params.endDate,
    periodLabel: labelPeriod(curStart, curEnd),
    compareStartDate: params.compareStartDate,
    compareEndDate: params.compareEndDate,
    compareLabel: labelPeriod(baseStart, baseEnd),
    currentTotals: extractTotals(dreCurrent.totals),
    baseTotals: extractTotals(dreBase.totals),
    variances: variancesResult.variances.map((v) => ({
      categoryName: v.categoryName,
      level: v.level,
      currentAmount: v.currentAmount,
      baseAmount: v.baseAmount,
      variationPct: v.variationPct,
    })),
    topCategoriesCurrent,
  }
}

// ============================================================
// Modo EVOLUTION — N meses + categorias emergentes/desaparecidas
// ============================================================

async function collectEvolution(
  params: CollectInsightDataParams,
): Promise<EvolutionInputData> {
  const { empresaId } = params
  const start = parsePeriodInput(params.startDate)
  const end = endOfMonthUTC(parsePeriodInput(params.endDate))

  const empresa = await prisma.company.findUnique({
    where: { id: empresaId },
    select: { name: true, tradeName: true },
  })
  if (!empresa) throw new Error('Empresa não encontrada')

  const multiTenantOR = buildMultiTenantOR(empresaId)

  const [categoriesRaw, txAllRaw] = await Promise.all([
    prisma.category.findMany({
      where: { companyId: empresaId },
      select: dreCategorySelect(),
    }),
    prisma.transaction.findMany({
      where: {
        lifecycle: 'EFFECTED',
        reconciledWithId: null,
        AND: [
          { OR: multiTenantOR },
          {
            OR: [
              { competenceDate: { gte: start, lte: end } },
              {
                competenceDate: null,
                date: { gte: start, lte: end },
              },
            ],
          },
        ],
      },
      select: txDRESelect(),
    }),
  ])

  const categories = mapCategories(categoriesRaw)

  // Buckets mensais — itera mês a mês
  const months: InsightMonthlySnapshot[] = []
  let cursor = startOfMonthUTC(start)
  while (cursor.getTime() <= end.getTime()) {
    const monthEnd = endOfMonthUTC(cursor)
    const txMonth = filterMapTxs(txAllRaw, cursor, monthEnd)
    const dre = calculateDRE(txMonth, categories, {
      period: { startDate: cursor, endDate: monthEnd, regime: 'competence' },
    })
    const totals = extractTotals(dre.totals)
    months.push({
      label: labelMonth(cursor),
      ym: `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`,
      ...totals,
    })
    cursor = addMonthsUTC(cursor, 1)
  }

  // Top categorias DESPESA agregadas no período TODO (com monthsPresent)
  const debitTxs = txAllRaw.filter((t) => t.type === 'DEBIT' && t.categoryId)
  type CatAgg = { total: number; monthsPresent: Set<string>; firstMonth: string; lastMonth: string }
  const byCat = new Map<string, CatAgg>()

  for (const t of debitTxs) {
    if (!t.categoryId) continue
    const ref = t.competenceDate ?? t.date
    const ymKey = `${ref.getUTCFullYear()}-${String(ref.getUTCMonth() + 1).padStart(2, '0')}`
    const existing = byCat.get(t.categoryId) ?? {
      total: 0,
      monthsPresent: new Set<string>(),
      firstMonth: ymKey,
      lastMonth: ymKey,
    }
    existing.total += t.amount
    existing.monthsPresent.add(ymKey)
    if (ymKey < existing.firstMonth) existing.firstMonth = ymKey
    if (ymKey > existing.lastMonth) existing.lastMonth = ymKey
    byCat.set(t.categoryId, existing)
  }

  const categoryNameMap = new Map(categories.map((c) => [c.id, c.name]))

  const topCategoriesArr: InsightTopCategoryEvolution[] = Array.from(
    byCat.entries(),
  )
    .map(([catId, agg]) => ({
      name: categoryNameMap.get(catId) ?? '(sem categoria)',
      total: agg.total,
      monthsPresent: agg.monthsPresent.size,
    }))
    .sort((a, b) => b.total - a.total)

  // Emergentes: monthsPresent <= 2 E lastMonth = ultimoMesPeriodo
  const monthsList = months.map((m) => m.ym)
  const ultimoMes = monthsList[monthsList.length - 1]
  const primeiroMes = monthsList[0]

  const emergingCategories: InsightEmergingCategory[] = []
  const disappearedCategories: InsightDisappearedCategory[] = []

  for (const [catId, agg] of byCat.entries()) {
    const name = categoryNameMap.get(catId) ?? '(sem categoria)'
    // Emergente: começou DEPOIS do primeiro mês do período
    if (agg.firstMonth !== primeiroMes && agg.lastMonth === ultimoMes) {
      emergingCategories.push({
        name,
        total: agg.total,
        firstMonth: labelMonthFromYM(agg.firstMonth),
      })
    }
    // Desaparecida: parou ANTES do último mês do período
    if (agg.lastMonth !== ultimoMes && agg.firstMonth !== ultimoMes) {
      // Existiu mas sumiu — só inclui se tinha presença razoável (3+ meses tinha valor)
      // ou total relevante (>= 1k)
      if (agg.monthsPresent.size >= 2 || agg.total >= 1000) {
        disappearedCategories.push({
          name,
          total: agg.total,
          lastMonth: labelMonthFromYM(agg.lastMonth),
        })
      }
    }
  }

  return {
    mode: 'evolution',
    empresaId,
    empresaName: empresa.tradeName ?? empresa.name,
    startDate: params.startDate,
    endDate: params.endDate,
    periodLabel: labelPeriod(start, end),
    months,
    topCategories: topCategoriesArr.slice(0, 15),
    emergingCategories: emergingCategories.slice(0, 8),
    disappearedCategories: disappearedCategories.slice(0, 5),
  }
}

function labelMonthFromYM(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return `${MES_FULL[m - 1]}/${y}`
}

// ============================================================
// Modo SINGLE — 1 período curto, sem comparação
// ============================================================

async function collectSingle(
  params: CollectInsightDataParams,
): Promise<SingleInputData> {
  const { empresaId } = params
  const start = parsePeriodInput(params.startDate)
  const end = endOfMonthUTC(parsePeriodInput(params.endDate))

  const empresa = await prisma.company.findUnique({
    where: { id: empresaId },
    select: { name: true, tradeName: true },
  })
  if (!empresa) throw new Error('Empresa não encontrada')

  const multiTenantOR = buildMultiTenantOR(empresaId)

  const [categoriesRaw, txAllRaw, topGrouped] = await Promise.all([
    prisma.category.findMany({
      where: { companyId: empresaId },
      select: dreCategorySelect(),
    }),
    prisma.transaction.findMany({
      where: {
        lifecycle: 'EFFECTED',
        reconciledWithId: null,
        AND: [
          { OR: multiTenantOR },
          {
            OR: [
              { competenceDate: { gte: start, lte: end } },
              {
                competenceDate: null,
                date: { gte: start, lte: end },
              },
            ],
          },
        ],
      },
      select: txDRESelect(),
    }),
    prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        OR: multiTenantOR,
        lifecycle: 'EFFECTED',
        reconciledWithId: null,
        type: 'DEBIT',
        categoryId: { not: null },
        paymentDate: { gte: start, lte: end, not: null },
      },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 10,
    }),
  ])

  const categories = mapCategories(categoriesRaw)
  const txs = filterMapTxs(txAllRaw, start, end)
  const dre = calculateDRE(txs, categories, {
    period: { startDate: start, endDate: end, regime: 'competence' },
  })

  const topCategoriesCurrent = await buildTopCategoriesSnapshot(empresaId, topGrouped)

  return {
    mode: 'single',
    empresaId,
    empresaName: empresa.tradeName ?? empresa.name,
    startDate: params.startDate,
    endDate: params.endDate,
    periodLabel: labelPeriod(start, end),
    currentTotals: extractTotals(dre.totals),
    topCategoriesCurrent,
  }
}

// ============================================================
// Helpers compartilhados
// ============================================================

function buildMultiTenantOR(empresaId: string) {
  return [
    { bankAccount: { companyId: empresaId } },
    { supplier: { companyId: empresaId } },
    { employee: { companyId: empresaId } },
    { customer: { companyId: empresaId } },
    { category: { companyId: empresaId } },
  ]
}

function dreCategorySelect() {
  return {
    id: true,
    name: true,
    code: true,
    dreGroup: true,
    parentId: true,
    isActive: true,
    type: true,
  } as const
}

function txDRESelect() {
  return {
    id: true,
    type: true,
    amount: true,
    date: true,
    competenceDate: true,
    paymentDate: true,
    categoryId: true,
  } as const
}

function mapCategories(
  raw: Array<{
    id: string
    name: string
    code: string | null
    dreGroup: string | null
    parentId: string | null
    isActive: boolean
    type: string
  }>,
): CategoryForDRE[] {
  return raw.map((c) => ({
    id: c.id,
    name: c.name,
    code: c.code,
    dreGroup: c.dreGroup ?? '',
    parentId: c.parentId,
    isActive: c.isActive,
    type: c.type,
  }))
}

function filterMapTxs(
  txs: Array<{
    id: string
    type: string
    amount: number
    date: Date
    competenceDate: Date | null
    paymentDate: Date | null
    categoryId: string | null
  }>,
  start: Date,
  end: Date,
): TransactionForDRE[] {
  return txs
    .filter((t) => {
      const ref = t.competenceDate ?? t.date
      return ref >= start && ref <= end
    })
    .map((t) => ({
      id: t.id,
      type: t.type as 'CREDIT' | 'DEBIT' | 'TRANSFER',
      amount: t.amount,
      date: t.date,
      competenceDate: t.competenceDate,
      paymentDate: t.paymentDate,
      categoryId: t.categoryId,
    }))
}

function extractTotals(t: {
  receitaBruta: number
  totalCustos: number
  totalDespesasOperacionais: number
  despesasFinanceiras: number
  impostosSobreLucro: number
  lucroLiquido: number
  margemLiquida: number
}): {
  receita: number
  despesas: number
  lucro: number
  margem: number
} {
  return {
    receita: t.receitaBruta,
    despesas:
      t.totalCustos +
      t.totalDespesasOperacionais +
      t.despesasFinanceiras +
      t.impostosSobreLucro,
    lucro: t.lucroLiquido,
    margem: t.receitaBruta > 0 ? t.margemLiquida : 0,
  }
}

async function buildTopCategoriesSnapshot(
  empresaId: string,
  grouped: Array<{ categoryId: string | null; _sum: { amount: number | null } }>,
): Promise<InsightCategorySnapshot[]> {
  const topIds = grouped
    .map((g) => g.categoryId)
    .filter((id): id is string => !!id)
  if (topIds.length === 0) return []

  const cats = await prisma.category.findMany({
    where: { id: { in: topIds }, companyId: empresaId },
    select: { id: true, name: true },
  })
  const byId = new Map(cats.map((c) => [c.id, c]))
  const totalAmount = grouped.reduce((s, g) => s + (g._sum.amount ?? 0), 0)

  return grouped
    .filter((g) => g.categoryId && byId.has(g.categoryId))
    .map((g) => ({
      name: byId.get(g.categoryId!)!.name,
      amount: g._sum.amount ?? 0,
      percent: totalAmount > 0 ? ((g._sum.amount ?? 0) / totalAmount) * 100 : 0,
    }))
}

// Wrapper de collectVariances que aceita Date input (lib aceita YYYY-MM string só)
async function collectVariancesForDateRange(
  empresaId: string,
  currentStart: Date,
  baseStart: Date,
) {
  // Converte Date pra YYYY-MM (lib existente trabalha em granularidade mensal)
  const ymOf = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  return collectVariances({
    empresaId,
    current: { ym: ymOf(currentStart) },
    base: { ym: ymOf(baseStart) },
  })
}

// Re-export pra usos externos (compat com calls antigos)
export { inferMode } from '@/lib/dates/period-presets'
export type { InsightMode }
