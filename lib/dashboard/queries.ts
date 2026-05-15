// Server-side queries do Dashboard Mundial — Sprint 1 Dia 1.
// Multi-tenant inviolável: TODA query escopada por companyId.
// Cache: unstable_cache com TTL 60s + tag pra invalidação manual no Sprint 2.

import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/db'
import { derivePeriods, deriveWaterfallRange } from './period'
import { computeKPIsFromData } from './compute-kpis'
import { computeMiniDRE, type MiniDREResult } from './compute-mini-dre'
import {
  computeTopCategories,
  type TopCategoriesResult,
  type CategoryGroup,
  type CategoryMeta,
} from './compute-top-categories'
import {
  computeHealthCheck,
  type HealthCheckResult,
  type BurnMonthBucket,
} from './compute-health'
import {
  computeWaterfall,
  type WaterfallResult,
  type WaterfallPeriodType,
  type WaterfallTransaction,
} from './compute-waterfall'
import { calculateDRE } from '@/lib/dre/calculator'
import { calculateConsolidatedCashflow } from '@/lib/cashflow/consolidated'
import type { CashflowTransaction } from '@/lib/cashflow/consolidated'
import type { HeroKPIsResult } from './types'
import type { CategoryForDRE, TransactionForDRE } from '@/lib/dre/types'

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
  const result = await cached()
  // ⚠️ unstable_cache do Next 15+ serializa via JSON: Date vira string ISO.
  // Reidrata o campo Date pra preservar o contrato de tipos.
  return {
    ...result,
    referenceDate: new Date(result.referenceDate),
  }
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

// ============================================================
// Saúde Financeira — Sprint 1 Dia 4
// ============================================================

export async function getHealthCheck(
  companyId: string,
  referenceDate: Date = new Date(),
): Promise<HealthCheckResult> {
  if (!companyId) {
    throw new Error('companyId é obrigatório (isolamento multi-tenant)')
  }
  const dayKey = referenceDate.toISOString().slice(0, 10)
  const cached = unstable_cache(
    async () => loadHealthCheck(companyId, referenceDate),
    [`dashboard:health:${companyId}:${dayKey}`],
    { revalidate: CACHE_TTL_SECONDS, tags: [`dashboard:${companyId}`] },
  )
  return cached()
}

async function loadHealthCheck(
  companyId: string,
  refDate: Date,
): Promise<HealthCheckResult> {
  const periods = derivePeriods(refDate)

  // Range dos 3 meses ANTERIORES (não inclui o atual — evita inflação parcial)
  const burnRangeStart = new Date(
    Date.UTC(
      periods.currentMonth.start.getUTCFullYear(),
      periods.currentMonth.start.getUTCMonth() - 3,
      1,
    ),
  )
  const burnRangeEnd = new Date(periods.currentMonth.start.getTime() - 1)

  // 5 queries paralelas (multi-tenant via bankAccount.companyId)
  const [accounts, categoriesRaw, txBurnRaw, txLast30dRaw, txCurrentMonthRaw] =
    await Promise.all([
      // 1. Contas ativas com flags de cheque especial
      prisma.bankAccount.findMany({
        where: { companyId, isActive: true },
        select: { balance: true, creditLimit: true, allowNegativeBalance: true },
      }),
      // 2. Categorias da empresa (pra DRE do mês atual)
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
      // 3. Transações dos 3 meses anteriores (burn rate)
      prisma.transaction.findMany({
        where: {
          bankAccount: { companyId },
          type: { not: 'TRANSFER' },
          date: { gte: burnRangeStart, lte: burnRangeEnd },
        },
        select: { id: true, type: true, amount: true, date: true },
      }),
      // 4. Variação 30d (net)
      prisma.transaction.findMany({
        where: {
          bankAccount: { companyId },
          type: { not: 'TRANSFER' },
          date: { gte: periods.last30Days.start, lte: periods.last30Days.end },
        },
        select: { id: true, type: true, amount: true, date: true },
      }),
      // 5. Mês atual (pra margem via DRE)
      prisma.transaction.findMany({
        where: {
          bankAccount: { companyId },
          OR: [
            {
              competenceDate: {
                gte: periods.currentMonth.start,
                lte: periods.currentMonth.end,
              },
            },
            {
              competenceDate: null,
              date: {
                gte: periods.currentMonth.start,
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

  // Burn history: 3 buckets month via calculateConsolidatedCashflow
  const burnCashflow = calculateConsolidatedCashflow(
    txBurnRaw.map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      date: t.date,
    })) as CashflowTransaction[],
    {
      startDate: burnRangeStart,
      endDate: burnRangeEnd,
      groupBy: 'month',
    },
    companyId,
  )

  const burnHistory: BurnMonthBucket[] = burnCashflow.byPeriod.map((b) => ({
    monthKey: b.bucketStart.toISOString().slice(0, 7),
    expense: b.expense,
    income: b.income,
  }))

  // Variação 30d (net)
  const cashflow30d = calculateConsolidatedCashflow(
    txLast30dRaw.map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      date: t.date,
    })) as CashflowTransaction[],
    {
      startDate: periods.last30Days.start,
      endDate: periods.last30Days.end,
      groupBy: 'day',
    },
    companyId,
  )

  // DRE mês atual pra margem
  const categories = categoriesRaw.map((c) => ({
    id: c.id,
    name: c.name,
    code: c.code,
    dreGroup: c.dreGroup ?? '',
    parentId: c.parentId,
    isActive: c.isActive,
    type: c.type,
  }))
  const txCurrentMonth = txCurrentMonthRaw.map((t) => ({
    id: t.id,
    type: t.type as 'CREDIT' | 'DEBIT' | 'TRANSFER',
    amount: t.amount,
    date: t.date,
    competenceDate: t.competenceDate,
    paymentDate: t.paymentDate,
    categoryId: t.categoryId,
  }))
  const dreCurrent = calculateDRE(txCurrentMonth, categories, {
    period: {
      startDate: periods.currentMonth.start,
      endDate: periods.currentMonth.end,
      regime: 'competence',
    },
  })

  return computeHealthCheck({
    companyId,
    referenceDate: refDate,
    accounts: accounts.map((a) => ({
      balance: a.balance,
      creditLimit: a.creditLimit,
      allowNegativeBalance: a.allowNegativeBalance,
    })),
    burnHistory,
    net30d: cashflow30d.totals.net,
    currentMonthRevenue: dreCurrent.totals.receitaBruta,
    currentMonthNetIncome: dreCurrent.totals.lucroLiquido,
  })
}

// ============================================================
// Recent Activity — Sprint 1 Dia 5
// ============================================================

export interface RecentActivityItem {
  id: string
  description: string
  amount: number
  type: 'CREDIT' | 'DEBIT' | 'TRANSFER'
  date: Date
  categoryName: string | null
  bankAccountId: string
  bankAccountName: string
}

export async function getRecentActivity(
  companyId: string,
  limit = 10,
): Promise<RecentActivityItem[]> {
  if (!companyId) {
    throw new Error('companyId é obrigatório (isolamento multi-tenant)')
  }
  const cached = unstable_cache(
    async () => loadRecentActivity(companyId, limit),
    [`dashboard:recent-activity:${companyId}:${limit}`],
    { revalidate: CACHE_TTL_SECONDS, tags: [`dashboard:${companyId}`] },
  )
  const items = await cached()
  // ⚠️ unstable_cache do Next 15+ serializa via JSON: Date vira string ISO.
  // Reidrata `date` pra preservar o contrato de tipos (RecentActivity.tsx
  // chama formatActivityDate(item.date) que precisa de Date pra `.getTime()`).
  // Bug em produção (12/05/2026): empresa com 753 tx quebrava com
  // "TypeError: a.getTime is not a function".
  return items.map((item) => ({ ...item, date: new Date(item.date) }))
}

async function loadRecentActivity(
  companyId: string,
  limit: number,
): Promise<RecentActivityItem[]> {
  const txs = await prisma.transaction.findMany({
    where: {
      bankAccount: { companyId },
      type: { not: 'TRANSFER' },
    },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    take: limit,
    select: {
      id: true,
      description: true,
      amount: true,
      type: true,
      date: true,
      category: { select: { name: true } },
      bankAccount: { select: { id: true, name: true } },
    },
  })

  return txs.map((t) => ({
    id: t.id,
    description: t.description,
    amount: t.amount,
    type: t.type as 'CREDIT' | 'DEBIT' | 'TRANSFER',
    date: t.date,
    categoryName: t.category?.name ?? null,
    bankAccountId: t.bankAccount.id,
    bankAccountName: t.bankAccount.name,
  }))
}

// ============================================================
// Pending Classification Count — Sprint 1 Dia 5
// ============================================================

export async function getPendingCount(companyId: string): Promise<number> {
  if (!companyId) {
    throw new Error('companyId é obrigatório (isolamento multi-tenant)')
  }
  const cached = unstable_cache(
    async () => loadPendingCount(companyId),
    [`dashboard:pending-count:${companyId}`],
    { revalidate: CACHE_TTL_SECONDS, tags: [`dashboard:${companyId}`] },
  )
  return cached()
}

async function loadPendingCount(companyId: string): Promise<number> {
  return prisma.transaction.count({
    where: {
      bankAccount: { companyId },
      status: 'PENDING',
    },
  })
}

// ============================================================
// Cashflow Waterfall — Sprint 2 Dia 1
// ============================================================

export async function getCashflowWaterfall(
  companyId: string,
  periodType: WaterfallPeriodType,
  referenceDate: Date = new Date(),
): Promise<WaterfallResult> {
  if (!companyId) {
    throw new Error('companyId é obrigatório (isolamento multi-tenant)')
  }
  const dayKey = referenceDate.toISOString().slice(0, 10)
  const cached = unstable_cache(
    async () => loadCashflowWaterfall(companyId, periodType, referenceDate),
    [`dashboard:waterfall:${companyId}:${periodType}:${dayKey}`],
    { revalidate: CACHE_TTL_SECONDS, tags: [`dashboard:${companyId}`] },
  )
  const result = await cached()
  // unstable_cache serializa Date → string. Reidrata os campos Date do period.
  // (lição do hotfix 12/05/2026)
  return {
    ...result,
    period: {
      startDate: new Date(result.period.startDate),
      endDate: new Date(result.period.endDate),
    },
  }
}

async function loadCashflowWaterfall(
  companyId: string,
  periodType: WaterfallPeriodType,
  refDate: Date,
): Promise<WaterfallResult> {
  const range = deriveWaterfallRange(periodType, refDate)

  // 3 queries paralelas (multi-tenant via bankAccount.companyId):
  const [accounts, txsInPeriodRaw, txsAfterPeriodRaw] = await Promise.all([
    // 1. Saldos cacheados (= saldo de HOJE)
    prisma.bankAccount.findMany({
      where: { companyId, isActive: true },
      select: { balance: true },
    }),
    // 2. Transações DENTRO do período (com dreGroup da categoria)
    prisma.transaction.findMany({
      where: {
        bankAccount: { companyId },
        date: { gte: range.start, lte: range.end },
      },
      select: {
        id: true,
        type: true,
        amount: true,
        date: true,
        category: { select: { dreGroup: true } },
      },
    }),
    // 3. Transações DEPOIS do período (pra ajustar saldoFinal ao fim do período)
    prisma.transaction.findMany({
      where: {
        bankAccount: { companyId },
        date: { gt: range.end },
      },
      select: { type: true, amount: true, category: { select: { dreGroup: true } } },
    }),
  ])

  const saldoAtual = accounts.reduce((s, a) => s + a.balance, 0)

  // net de uma lista de transações (exclui TRANSFER e AJUSTE_SALDO — não são
  // fluxo de caixa real pro waterfall)
  const netOf = (
    txs: Array<{ type: string; amount: number; category: { dreGroup: string | null } | null }>,
  ): number =>
    txs.reduce((sum, t) => {
      if (t.type === 'TRANSFER') return sum
      if (t.category?.dreGroup === 'AJUSTE_SALDO') return sum
      if (t.type === 'CREDIT') return sum + t.amount
      if (t.type === 'DEBIT') return sum - t.amount
      return sum
    }, 0)

  // saldoFinal do período = saldo de hoje − net das transações pós-período
  const saldoFinal = saldoAtual - netOf(txsAfterPeriodRaw)

  const transactions: WaterfallTransaction[] = txsInPeriodRaw.map((t) => ({
    id: t.id,
    type: t.type as 'CREDIT' | 'DEBIT' | 'TRANSFER',
    amount: t.amount,
    date: t.date,
    dreGroup: t.category?.dreGroup ?? null,
  }))

  return computeWaterfall({
    companyId,
    periodType,
    periodStart: range.start,
    periodEnd: range.end,
    saldoFinal,
    transactions,
  })
}
