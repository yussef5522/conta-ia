// Sprint 5.0.4.0c1 — Coletor de dados pra variâncias.
// Server-side: lê transações de 2 períodos + agrupa por categoria.

import { prisma } from '@/lib/db'
import {
  detectVariances,
  summarizeVariances,
  type CategoryPeriodData,
  type VarianceResult,
  type VarianceSummary,
  type DetectVariancesOptions,
} from './detect-variances'

export interface PeriodInput {
  /** YYYY-MM */
  ym: string
}

export interface CollectVariancesParams {
  empresaId: string
  current: PeriodInput
  base: PeriodInput
  options?: DetectVariancesOptions
}

export interface CollectVariancesResult {
  variances: VarianceResult[]
  summary: VarianceSummary
  periods: {
    current: { ym: string; start: Date; end: Date }
    base: { ym: string; start: Date; end: Date }
  }
  totals: {
    currentSum: number
    baseSum: number
  }
}

function startOfMonthYMUTC(ym: string): Date {
  const [y, m] = ym.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1))
}

function endOfMonthYMUTC(ym: string): Date {
  const [y, m] = ym.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0, 23, 59, 59, 999))
}

/**
 * Coleta categorias × amount agregado pra UM período.
 * Multi-tenant via OR(bankAccount, supplier, employee, category).companyId.
 * Filtra: EFFECTED, reconciledWithId=null, type='DEBIT', paymentDate IS NOT NULL, categoryId IS NOT NULL.
 */
async function loadPeriodData(
  empresaId: string,
  start: Date,
  end: Date,
): Promise<CategoryPeriodData[]> {
  const grouped = await prisma.transaction.groupBy({
    by: ['categoryId'],
    where: {
      OR: [
        { bankAccount: { companyId: empresaId } },
        { supplier: { companyId: empresaId } },
        { employee: { companyId: empresaId } },
        { customer: { companyId: empresaId } },
        { category: { companyId: empresaId } },
      ],
      lifecycle: 'EFFECTED',
      reconciledWithId: null,
      type: 'DEBIT',
      categoryId: { not: null },
      paymentDate: { gte: start, lte: end, not: null },
    },
    _sum: { amount: true },
  })

  if (grouped.length === 0) return []

  const categoryIds = grouped
    .map((g) => g.categoryId)
    .filter((id): id is string => !!id)

  const cats = await prisma.category.findMany({
    where: { id: { in: categoryIds }, companyId: empresaId },
    select: { id: true, name: true, dreGroup: true },
  })
  const byId = new Map(cats.map((c) => [c.id, c]))

  return grouped
    .filter((g) => !!g.categoryId)
    .map((g) => {
      const cat = byId.get(g.categoryId!)
      if (!cat) return null
      return {
        categoryId: cat.id,
        categoryName: cat.name,
        dreGroup: cat.dreGroup,
        amount: g._sum.amount ?? 0,
      } satisfies CategoryPeriodData
    })
    .filter((x): x is CategoryPeriodData => x !== null)
}

export async function collectVariances(
  params: CollectVariancesParams,
): Promise<CollectVariancesResult> {
  const { empresaId, current, base, options } = params

  if (!empresaId) {
    throw new Error('empresaId obrigatório (multi-tenant)')
  }

  const currentStart = startOfMonthYMUTC(current.ym)
  const currentEnd = endOfMonthYMUTC(current.ym)
  const baseStart = startOfMonthYMUTC(base.ym)
  const baseEnd = endOfMonthYMUTC(base.ym)

  const [currentData, baseData] = await Promise.all([
    loadPeriodData(empresaId, currentStart, currentEnd),
    loadPeriodData(empresaId, baseStart, baseEnd),
  ])

  const variances = detectVariances(currentData, baseData, options)
  const summary = summarizeVariances(variances)

  return {
    variances,
    summary,
    periods: {
      current: { ym: current.ym, start: currentStart, end: currentEnd },
      base: { ym: base.ym, start: baseStart, end: baseEnd },
    },
    totals: {
      currentSum: currentData.reduce((s, c) => s + c.amount, 0),
      baseSum: baseData.reduce((s, c) => s + c.amount, 0),
    },
  }
}
