// Fluxo de caixa POR CONTA bancária (uma bankAccount específica).
// Sprint 0.5 Dia 3 — função PURA.
//
// INCLUI type='TRANSFER' (visibilidade total da movimentação da conta).
// Direção do TRANSFER vem via signedAmount (já preparado pelo caller via
// lib/balance/prepare.ts).
//
// ⚠️ MULTI-TENANT: caller usa buildByAccountCashflowWhere(bankAccountId).
// O bankAccountId vai pro metadata.

import type { CashflowEntry, CashflowGroupBy, CashflowPeriod } from './consolidated'
import { bucketFor } from './consolidated'

export interface CashflowByAccountTransaction {
  id: string
  date: Date
  signedAmount: number // já com sinal: +entrada, -saída
}

export interface CashflowByAccountResult {
  bankAccountId: string
  period: CashflowPeriod
  byPeriod: CashflowEntry[]
  totals: {
    income: number
    expense: number
    net: number
    transactionCount: number
  }
}

export function calculateByAccountCashflow(
  transactions: CashflowByAccountTransaction[],
  period: CashflowPeriod,
  bankAccountId: string,
): CashflowByAccountResult {
  if (!bankAccountId) {
    throw new Error('bankAccountId é obrigatório')
  }
  if (period.startDate.getTime() > period.endDate.getTime()) {
    throw new Error('startDate não pode ser maior que endDate')
  }

  const buckets = new Map<
    string,
    { bucketStart: Date; bucketEnd: Date; income: number; expense: number; count: number }
  >()

  let totalIncome = 0
  let totalExpense = 0
  let totalCount = 0

  for (const tx of transactions) {
    const txMs = tx.date.getTime()
    if (
      txMs < period.startDate.getTime() ||
      txMs > period.endDate.getTime()
    ) {
      continue
    }

    const bucket = bucketFor(tx.date, period.groupBy)
    const key = bucket.bucketStart.toISOString()
    const existing = buckets.get(key) ?? {
      bucketStart: bucket.bucketStart,
      bucketEnd: bucket.bucketEnd,
      income: 0,
      expense: 0,
      count: 0,
    }

    if (tx.signedAmount > 0) {
      existing.income += tx.signedAmount
      totalIncome += tx.signedAmount
    } else if (tx.signedAmount < 0) {
      existing.expense += -tx.signedAmount
      totalExpense += -tx.signedAmount
    }
    existing.count++
    totalCount++

    buckets.set(key, existing)
  }

  const byPeriod: CashflowEntry[] = Array.from(buckets.values())
    .sort((a, b) => a.bucketStart.getTime() - b.bucketStart.getTime())
    .map((b) => ({
      bucketStart: b.bucketStart,
      bucketEnd: b.bucketEnd,
      income: b.income,
      expense: b.expense,
      net: b.income - b.expense,
      transactionCount: b.count,
    }))

  return {
    bankAccountId,
    period,
    byPeriod,
    totals: {
      income: totalIncome,
      expense: totalExpense,
      net: totalIncome - totalExpense,
      transactionCount: totalCount,
    },
  }
}

// Re-export CashflowGroupBy/CashflowPeriod pra conveniência do caller
export type { CashflowGroupBy, CashflowPeriod } from './consolidated'
