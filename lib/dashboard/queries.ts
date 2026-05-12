// Server-side queries do Dashboard Mundial — Sprint 1 Dia 1.
// Multi-tenant inviolável: TODA query escopada por companyId.
// Cache: unstable_cache com TTL 60s + tag pra invalidação manual no Sprint 2.

import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/db'
import { derivePeriods } from './period'
import { computeKPIsFromData } from './compute-kpis'
import { computeMiniDRE, type MiniDREResult } from './compute-mini-dre'
import {
  computeTopCategories,
  type TopCategoriesResult,
  type CategoryGroup,
  type CategoryMeta,
} from './compute-top-categories'
import { calculateDRE } from '@/lib/dre/calculator'
import type { HeroKPIsResult } from './types'
import type { CategoryForDRE, TransactionForDRE } from '@/lib/dre/types'
import type { CashflowTransaction } from '@/lib/cashflow/consolidated'

const CACHE_TTL_SECONDS = 60

export async function getHeroKPIs(
  companyId: string,
  referenceDate: Date = new Date(),
): Promise<HeroKPIsResult> {
  if (!companyId) {
    throw new Error('companyId é obrigatório (isolamento multi-tenant)')
  }

  // Granularidade do cache = dia. Refresh acontece a cada 60s ou via revalidateTag
  // (Sprint 2: chamado em mutations de transação/transferência).
  const dayKey = referenceDate.toISOString().slice(0, 10)
  const cached = unstable_cache(
    async () => loadHeroKPIs(companyId, referenceDate),
    [`dashboard:hero-kpis:${companyId}:${dayKey}`],
    {
      revalidate: CACHE_TTL_SECONDS,
      tags: [`dashboard:${companyId}`],
    },
  )
  return cached()
}

async function loadHeroKPIs(
  companyId: string,
  referenceDate: Date,
): Promise<HeroKPIsResult> {
  const periods = derivePeriods(referenceDate)

  // 5 queries paralelas — multi-tenant via bankAccount.companyId (ou companyId direto em Category)
  const [accounts, categoriesRaw, txForDRERaw, txLast30dRaw, txLast12mRaw] =
    await Promise.all([
      // 1. Saldos cacheados das contas (instantâneo)
      prisma.bankAccount.findMany({
        where: { companyId, isActive: true },
        select: { balance: true },
      }),
      // 2. Categorias pra DRE
      prisma.category.findMany({
        where: { companyId },
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
      // 3. Transações pro DRE: cobrir range current + previous month
      prisma.transaction.findMany({
        where: {
          bankAccount: { companyId },
          OR: [
            {
              competenceDate: {
                gte: periods.previousMonth.start,
                lte: periods.currentMonth.end,
              },
            },
            {
              competenceDate: null,
              date: {
                gte: periods.previousMonth.start,
                lte: periods.currentMonth.end,
              },
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
      // 4. Últimos 30 dias — sparkline saldo cumulativo. SEM TRANSFER pra fluxo líquido.
      prisma.transaction.findMany({
        where: {
          bankAccount: { companyId },
          type: { not: 'TRANSFER' },
          date: { gte: periods.last30Days.start, lte: periods.last30Days.end },
        },
        select: { id: true, type: true, amount: true, date: true },
      }),
      // 5. Últimos 12 meses — sparkline receita/despesa mensal. SEM TRANSFER.
      prisma.transaction.findMany({
        where: {
          bankAccount: { companyId },
          type: { not: 'TRANSFER' },
          date: { gte: periods.last12Months.start, lte: periods.last12Months.end },
        },
        select: { id: true, type: true, amount: true, date: true },
      }),
    ])

  const accountsBalanceTotal = accounts.reduce((s, a) => s + a.balance, 0)

  const categories: CategoryForDRE[] = categoriesRaw.map((c) => ({
    id: c.id,
    name: c.name,
    code: c.code,
    dreGroup: c.dreGroup ?? '',
    parentId: c.parentId,
    isActive: c.isActive,
    type: c.type,
  }))

  const transactionsForDRE: TransactionForDRE[] = txForDRERaw.map((t) => ({
    id: t.id,
    type: t.type as 'CREDIT' | 'DEBIT' | 'TRANSFER',
    amount: t.amount,
    date: t.date,
    competenceDate: t.competenceDate,
    paymentDate: t.paymentDate,
    categoryId: t.categoryId,
  }))

  const transactionsLast30d: CashflowTransaction[] = txLast30dRaw.map((t) => ({
    id: t.id,
    type: t.type,
    amount: t.amount,
    date: t.date,
  }))

  const transactionsLast12m: CashflowTransaction[] = txLast12mRaw.map((t) => ({
    id: t.id,
    type: t.type,
    amount: t.amount,
    date: t.date,
  }))

  return computeKPIsFromData({
    companyId,
    referenceDate,
    periods,
    accountsBalanceTotal,
    categories,
    transactionsForDRE,
    transactionsLast30d,
    transactionsLast12m,
  })
}

// ============================================================
// Mini-DRE — Sprint 1 Dia 2
// ============================================================

export async function getMiniDRE(
  companyId: string,
  referenceDate: Date = new Date(),
): Promise<MiniDREResult> {
  if (!companyId) {
    throw new Error('companyId é obrigatório (isolamento multi-tenant)')
  }
  const dayKey = referenceDate.toISOString().slice(0, 10)
  const cached = unstable_cache(
    async () => loadMiniDRE(companyId, referenceDate),
    [`dashboard:mini-dre:${companyId}:${dayKey}`],
    { revalidate: CACHE_TTL_SECONDS, tags: [`dashboard:${companyId}`] },
  )
  return cached()
}

async function loadMiniDRE(companyId: string, refDate: Date): Promise<MiniDREResult> {
  const periods = derivePeriods(refDate)

  // Range cobrindo current + previous month — 1 query só
  const [categoriesRaw, txsRaw] = await Promise.all([
    prisma.category.findMany({
      where: { companyId },
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
    prisma.transaction.findMany({
      where: {
        bankAccount: { companyId },
        OR: [
          {
            competenceDate: {
              gte: periods.previousMonth.start,
              lte: periods.currentMonth.end,
            },
          },
          {
            competenceDate: null,
            date: {
              gte: periods.previousMonth.start,
              lte: periods.currentMonth.end,
            },
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
  const transactions: TransactionForDRE[] = txsRaw.map((t) => ({
    id: t.id,
    type: t.type as 'CREDIT' | 'DEBIT' | 'TRANSFER',
    amount: t.amount,
    date: t.date,
    competenceDate: t.competenceDate,
    paymentDate: t.paymentDate,
    categoryId: t.categoryId,
  }))

  const dreCurrent = calculateDRE(transactions, categories, {
    period: {
      startDate: periods.currentMonth.start,
      endDate: periods.currentMonth.end,
      regime: 'competence',
    },
  })
  const drePrevious = calculateDRE(transactions, categories, {
    period: {
      startDate: periods.previousMonth.start,
      endDate: periods.previousMonth.end,
      regime: 'competence',
    },
  })

  return computeMiniDRE(dreCurrent.totals, drePrevious.totals, companyId)
}

// ============================================================
// Top 5 Categorias de Despesa — Sprint 1 Dia 2
// ============================================================

export async function getTopCategories(
  companyId: string,
  referenceDate: Date = new Date(),
): Promise<TopCategoriesResult> {
  if (!companyId) {
    throw new Error('companyId é obrigatório (isolamento multi-tenant)')
  }
  const dayKey = referenceDate.toISOString().slice(0, 10)
  const cached = unstable_cache(
    async () => loadTopCategories(companyId, referenceDate),
    [`dashboard:top-categories:${companyId}:${dayKey}`],
    { revalidate: CACHE_TTL_SECONDS, tags: [`dashboard:${companyId}`] },
  )
  return cached()
}

async function loadTopCategories(
  companyId: string,
  refDate: Date,
): Promise<TopCategoriesResult> {
  const periods = derivePeriods(refDate)

  // 1. Agrega sums por categoria via Prisma groupBy.
  //    Multi-tenant guard: bankAccount.companyId.
  //    Filtra TRANSFER + categoryId NULL antes de agregar.
  //    take=20 pra deixar margem (filtramos só despesas depois, então pega mais
  //    e o slice(0,5) limita).
  const grouped = await prisma.transaction.groupBy({
    by: ['categoryId'],
    where: {
      bankAccount: { companyId },
      type: { not: 'TRANSFER' },
      categoryId: { not: null },
      date: {
        gte: periods.currentMonth.start,
        lte: periods.currentMonth.end,
      },
    },
    _sum: { amount: true },
    orderBy: { _sum: { amount: 'desc' } },
    take: 20,
  })

  if (grouped.length === 0) {
    return { items: [], totalDespesas: 0, companyId }
  }

  // 2. Fetch metadata das categorias agregadas
  const categoryIds = grouped
    .map((g) => g.categoryId)
    .filter((id): id is string => !!id)

  const categoriesRaw = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true, dreGroup: true },
  })

  const categoriesById = new Map<string, CategoryMeta>(
    categoriesRaw.map((c) => [c.id, { id: c.id, name: c.name, dreGroup: c.dreGroup }]),
  )

  const groups: CategoryGroup[] = grouped
    .filter((g): g is typeof g & { categoryId: string } => !!g.categoryId)
    .map((g) => ({
      categoryId: g.categoryId,
      totalAmount: g._sum.amount ?? 0,
    }))

  return computeTopCategories(groups, categoriesById, companyId, 5)
}
