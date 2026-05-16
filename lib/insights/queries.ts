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

  const [pendingCount, accountsRaw, txsBurnRaw] = await Promise.all([
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

  return computeInsights({
    companyId,
    pendingCount,
    accounts,
    burnHistory,
  })
}
