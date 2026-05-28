// Sprint 5.0.4.0c1 — Orquestrador da coleta de dados pro prompt da IA.
//
// Reusa engines existentes:
// - calculateDRE (lib/dre/calculator) → totals dos 2 períodos
// - collectVariances (lib/variance/collect) → variâncias detectadas
// - groupBy Prisma → top categorias do mês atual
//
// Tudo paralelo via Promise.all.

import { prisma } from '@/lib/db'
import { calculateDRE } from '@/lib/dre/calculator'
import { collectVariances } from '@/lib/variance/collect'
import type { CategoryForDRE, TransactionForDRE } from '@/lib/dre/types'
import type { InsightInputData } from './insights-types'

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

function labelYM(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return `${MES_FULL[m - 1]}/${y}`
}

function startOfMonthYMUTC(ym: string): Date {
  const [y, m] = ym.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1))
}

function endOfMonthYMUTC(ym: string): Date {
  const [y, m] = ym.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0, 23, 59, 59, 999))
}

export interface CollectInsightDataParams {
  empresaId: string
  currentPeriod: string // YYYY-MM
  basePeriod: string // YYYY-MM
}

export async function collectInsightData(
  params: CollectInsightDataParams,
): Promise<InsightInputData> {
  const { empresaId, currentPeriod, basePeriod } = params

  if (!empresaId) {
    throw new Error('empresaId obrigatório (multi-tenant)')
  }

  const empresa = await prisma.company.findUnique({
    where: { id: empresaId },
    select: { name: true, tradeName: true },
  })
  if (!empresa) {
    throw new Error('Empresa não encontrada')
  }

  const curStart = startOfMonthYMUTC(currentPeriod)
  const curEnd = endOfMonthYMUTC(currentPeriod)
  const baseStart = startOfMonthYMUTC(basePeriod)
  const baseEnd = endOfMonthYMUTC(basePeriod)

  // Range total que cobre os 2 períodos (otimização SQL: 1 query só, filtragem
  // mais fina em memória depois)
  const rangeStart = curStart < baseStart ? curStart : baseStart
  const rangeEnd = curEnd > baseEnd ? curEnd : baseEnd

  // Multi-tenant OR (reusado em várias buscas)
  const multiTenantOR = [
    { bankAccount: { companyId: empresaId } },
    { supplier: { companyId: empresaId } },
    { employee: { companyId: empresaId } },
    { customer: { companyId: empresaId } },
    { category: { companyId: empresaId } },
  ]

  const [categoriesRaw, txAllRaw, variancesResult, topGroupedCurrent] =
    await Promise.all([
      prisma.category.findMany({
        where: { companyId: empresaId },
        select: {
          id: true,
          name: true,
          code: true,
          dreGroup: true,
          parentId: true,
          isActive: true,
          type: true,
        },
      }),
      // 1 query pra ambos períodos (filtra em memória depois)
      prisma.transaction.findMany({
        where: {
          lifecycle: 'EFFECTED',
          reconciledWithId: null,
          // AND combinado: multi-tenant + filtro de range
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
        select: {
          id: true,
          type: true,
          amount: true,
          date: true,
          competenceDate: true,
          paymentDate: true,
          categoryId: true,
        },
      }),
      collectVariances({
        empresaId,
        current: { ym: currentPeriod },
        base: { ym: basePeriod },
      }),
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

  const categories: CategoryForDRE[] = categoriesRaw.map((c) => ({
    id: c.id,
    name: c.name,
    code: c.code,
    dreGroup: c.dreGroup ?? '',
    parentId: c.parentId,
    isActive: c.isActive,
    type: c.type,
  }))

  function inRange(
    t: (typeof txAllRaw)[number],
    start: Date,
    end: Date,
  ): boolean {
    const refDate = t.competenceDate ?? t.date
    return refDate >= start && refDate <= end
  }

  const txCurrent: TransactionForDRE[] = txAllRaw
    .filter((t) => inRange(t, curStart, curEnd))
    .map((t) => ({
      id: t.id,
      type: t.type as 'CREDIT' | 'DEBIT' | 'TRANSFER',
      amount: t.amount,
      date: t.date,
      competenceDate: t.competenceDate,
      paymentDate: t.paymentDate,
      categoryId: t.categoryId,
    }))

  const txBase: TransactionForDRE[] = txAllRaw
    .filter((t) => inRange(t, baseStart, baseEnd))
    .map((t) => ({
      id: t.id,
      type: t.type as 'CREDIT' | 'DEBIT' | 'TRANSFER',
      amount: t.amount,
      date: t.date,
      competenceDate: t.competenceDate,
      paymentDate: t.paymentDate,
      categoryId: t.categoryId,
    }))

  const dreCurrent = calculateDRE(txCurrent, categories, {
    period: { startDate: curStart, endDate: curEnd, regime: 'competence' },
  })
  const dreBase = calculateDRE(txBase, categories, {
    period: { startDate: baseStart, endDate: baseEnd, regime: 'competence' },
  })

  // Top categorias do mês atual (com nome)
  const topIds = topGroupedCurrent
    .map((g) => g.categoryId)
    .filter((id): id is string => !!id)
  const topCats = await prisma.category.findMany({
    where: { id: { in: topIds }, companyId: empresaId },
    select: { id: true, name: true },
  })
  const topCatsById = new Map(topCats.map((c) => [c.id, c]))
  const totalTopAmount = topGroupedCurrent.reduce(
    (s, g) => s + (g._sum.amount ?? 0),
    0,
  )

  const topCategoriesCurrent = topGroupedCurrent
    .filter((g) => g.categoryId && topCatsById.has(g.categoryId))
    .map((g) => ({
      name: topCatsById.get(g.categoryId!)!.name,
      amount: g._sum.amount ?? 0,
      percent:
        totalTopAmount > 0
          ? ((g._sum.amount ?? 0) / totalTopAmount) * 100
          : 0,
    }))

  return {
    empresaId,
    empresaName: empresa.tradeName ?? empresa.name,
    currentPeriod,
    basePeriod,
    currentLabel: labelYM(currentPeriod),
    baseLabel: labelYM(basePeriod),
    currentTotals: {
      receita: dreCurrent.totals.receitaBruta,
      despesas:
        dreCurrent.totals.totalCustos +
        dreCurrent.totals.totalDespesasOperacionais +
        dreCurrent.totals.despesasFinanceiras +
        dreCurrent.totals.impostosSobreLucro,
      lucro: dreCurrent.totals.lucroLiquido,
      margem:
        dreCurrent.totals.receitaBruta > 0 ? dreCurrent.totals.margemLiquida : 0,
    },
    baseTotals: {
      receita: dreBase.totals.receitaBruta,
      despesas:
        dreBase.totals.totalCustos +
        dreBase.totals.totalDespesasOperacionais +
        dreBase.totals.despesasFinanceiras +
        dreBase.totals.impostosSobreLucro,
      lucro: dreBase.totals.lucroLiquido,
      margem:
        dreBase.totals.receitaBruta > 0 ? dreBase.totals.margemLiquida : 0,
    },
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
