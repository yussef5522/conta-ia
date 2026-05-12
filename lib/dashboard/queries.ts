// Server-side queries do Dashboard Mundial — Sprint 1 Dia 1.
// Multi-tenant inviolável: TODA query escopada por companyId.
// Cache: unstable_cache com TTL 60s + tag pra invalidação manual no Sprint 2.

import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/db'
import { derivePeriods } from './period'
import { computeKPIsFromData } from './compute-kpis'
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
