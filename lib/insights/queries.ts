// Server-side queries de AI Insights — Sprint 2 Dia 3.
// 3 queries paralelas + computeInsights (puro).
// Cache: unstable_cache TTL 1h + tag insights:${companyId}.

import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/db'
import { computeInsights } from './compute-insights'
import type {
  Insight,
  InsightAccountSnapshot,
  BurnHistoryEntry,
  InsightTransaction,
} from './types'
import {
  calculateConsolidatedCashflow,
  type CashflowTransaction,
} from '@/lib/cashflow/consolidated'

const CACHE_TTL_SECONDS = 3600 // 1h

export async function getInsights(
  companyId: string,
  referenceDate: Date = new Date(),
): Promise<Insight[]> {
  if (!companyId) {
    throw new Error('companyId é obrigatório (isolamento multi-tenant)')
  }
  const dayKey = referenceDate.toISOString().slice(0, 10)
  const cached = unstable_cache(
    async () => loadInsights(companyId, referenceDate),
    [`insights:${companyId}:${dayKey}`],
    { revalidate: CACHE_TTL_SECONDS, tags: [`insights:${companyId}`] },
  )
  // Insight não tem campos Date no payload — sem rehydration necessária.
  return cached()
}

async function loadInsights(companyId: string, refDate: Date): Promise<Insight[]> {
  // Range: 6 meses ANTERIORES (não inclui o atual — burnHistory pro spike)
  const burnRangeStart = new Date(
    Date.UTC(refDate.getUTCFullYear(), refDate.getUTCMonth() - 6, 1),
  )
  const burnRangeEnd = new Date(
    Date.UTC(refDate.getUTCFullYear(), refDate.getUTCMonth(), 1) - 1,
  )

  // Sprint 2 Dia 4: ranges adicionais pros 4 detectors novos.
  const refMs = refDate.getTime()
  const MS_PER_DAY = 24 * 60 * 60 * 1000
  const last30dStart = new Date(refMs - 30 * MS_PER_DAY)
  const last90dStart = new Date(refMs - 90 * MS_PER_DAY)
  // expenseTx6m: 6 meses INCLUINDO o atual (vs burnRange que exclui o atual)
  const last6mStart = new Date(
    Date.UTC(refDate.getUTCFullYear(), refDate.getUTCMonth() - 5, 1),
  )

  const [
    pendingCount,
    accountsRaw,
    txsBurnRaw,
    uncategorizedRaw,
    creditTx90dRaw,
    expenseTx6mRaw,
  ] = await Promise.all([
    // 1. Contagem de PENDING
    prisma.transaction.count({
      where: { bankAccount: { companyId }, status: 'PENDING' },
    }),
    // 2. Contas ativas
    prisma.bankAccount.findMany({
      where: { companyId, isActive: true },
      select: {
        id: true,
        name: true,
        balance: true,
        creditLimit: true,
        allowNegativeBalance: true,
      },
    }),
    // 3. Transações dos últimos 6 meses (anteriores ao atual) pra burn history
    prisma.transaction.findMany({
      where: {
        bankAccount: { companyId },
        type: { not: 'TRANSFER' },
        date: { gte: burnRangeStart, lte: burnRangeEnd },
      },
      select: { id: true, type: true, amount: true, date: true, category: { select: { dreGroup: true } } },
    }),
    // 4. Uncategorized últimos 30d (large-uncategorized) — sem TRANSFER
    prisma.transaction.findMany({
      where: {
        bankAccount: { companyId },
        categoryId: null,
        type: { not: 'TRANSFER' },
        date: { gte: last30dStart, lte: refDate },
      },
      select: {
        id: true,
        description: true,
        amount: true,
        type: true,
        date: true,
      },
    }),
    // 5. CREDIT últimos 90d (concentration-risk + revenue-growth)
    prisma.transaction.findMany({
      where: {
        bankAccount: { companyId },
        type: 'CREDIT',
        date: { gte: last90dStart, lte: refDate },
      },
      select: {
        id: true,
        description: true,
        amount: true,
        type: true,
        date: true,
        category: { select: { dreGroup: true } },
      },
    }),
    // 6. DEBIT últimos 6 meses (duplicate-subscriptions). Exclui categoria
    // dreGroup=TRANSFERENCIA — não são despesa real.
    prisma.transaction.findMany({
      where: {
        bankAccount: { companyId },
        type: 'DEBIT',
        date: { gte: last6mStart, lte: refDate },
        NOT: { category: { dreGroup: 'TRANSFERENCIA' } },
      },
      select: {
        id: true,
        description: true,
        amount: true,
        type: true,
        date: true,
        category: { select: { dreGroup: true } },
      },
    }),
  ])

  // Filtra AJUSTE_SALDO + TRANSFERENCIA do burnHistory (não são despesa real).
  // dreGroup também é passado ao engine como defesa em profundidade.
  const txsBurn: CashflowTransaction[] = txsBurnRaw
    .filter(
      (t) =>
        t.category?.dreGroup !== 'AJUSTE_SALDO' &&
        t.category?.dreGroup !== 'TRANSFERENCIA',
    )
    .map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      date: t.date,
      dreGroup: t.category?.dreGroup ?? null,
    }))

  // Agrupa por mês usando o engine consolidado do Sprint 0.5
  const cashflow = calculateConsolidatedCashflow(
    txsBurn,
    {
      startDate: burnRangeStart,
      endDate: burnRangeEnd,
      groupBy: 'month',
    },
    companyId,
  )

  const burnHistory: BurnHistoryEntry[] = cashflow.byPeriod.map((b) => ({
    monthKey: b.bucketStart.toISOString().slice(0, 7),
    expense: b.expense,
    income: b.income,
  }))

  const accounts: InsightAccountSnapshot[] = accountsRaw.map((a) => ({
    id: a.id,
    name: a.name,
    balance: a.balance,
    creditLimit: a.creditLimit,
    allowNegativeBalance: a.allowNegativeBalance,
  }))

  // Sprint 2 Dia 4: mapeamento pros 3 novos campos do contexto.
  const uncategorizedLast30d: InsightTransaction[] = uncategorizedRaw.map(
    (t) => ({
      id: t.id,
      description: t.description,
      amount: t.amount,
      type: t.type,
      date: t.date,
      dreGroup: null, // uncategorized por definição
    }),
  )

  const creditTx90d: InsightTransaction[] = creditTx90dRaw.map((t) => ({
    id: t.id,
    description: t.description,
    amount: t.amount,
    type: t.type,
    date: t.date,
    dreGroup: t.category?.dreGroup ?? null,
  }))

  const expenseTx6m: InsightTransaction[] = expenseTx6mRaw.map((t) => ({
    id: t.id,
    description: t.description,
    amount: t.amount,
    type: t.type,
    date: t.date,
    dreGroup: t.category?.dreGroup ?? null,
  }))

  return computeInsights({
    companyId,
    pendingCount,
    accounts,
    burnHistory,
    uncategorizedLast30d,
    creditTx90d,
    expenseTx6m,
  })
}
