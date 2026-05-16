// Fluxo de caixa CONSOLIDADO de UMA empresa.
// Sprint 0.5 Dia 3 — função PURA.
//
// IGNORA type='TRANSFER' (não infla receita/despesa).
// Bucketing: day | week (segunda BR) | month.
//
// ⚠️ MULTI-TENANT: a função recebe transações já filtradas (caller usa
// buildConsolidatedCashflowWhere). O parâmetro companyId vai pro metadata
// pra rastreabilidade e é validado em runtime.

export interface CashflowTransaction {
  id: string
  date: Date
  amount: number // sempre positivo
  type: 'CREDIT' | 'DEBIT' | string // TRANSFER se aparecer aqui é defendida via filtro
  // dreGroup da categoria (opcional pra retrocompat com callers antigos).
  // Quando == 'TRANSFERENCIA' a transação é tratada como movimentação interna
  // e excluída do fluxo de caixa consolidado, mesmo se type for CREDIT/DEBIT.
  dreGroup?: string | null
}

export type CashflowGroupBy = 'day' | 'week' | 'month'

export interface CashflowPeriod {
  startDate: Date
  endDate: Date
  groupBy: CashflowGroupBy
}

export interface CashflowEntry {
  bucketStart: Date
  bucketEnd: Date
  income: number
  expense: number // positivo (sem sinal)
  net: number // income - expense
  transactionCount: number
}

export interface CashflowConsolidatedResult {
  companyId: string
  period: CashflowPeriod
  byPeriod: CashflowEntry[]
  totals: {
    income: number
    expense: number
    net: number
    transactionCount: number
  }
}

export function calculateConsolidatedCashflow(
  transactions: CashflowTransaction[],
  period: CashflowPeriod,
  companyId: string,
): CashflowConsolidatedResult {
  if (!companyId) {
    throw new Error(
      'companyId é obrigatório (isolamento multi-tenant inviolável)',
    )
  }
  if (period.startDate.getTime() > period.endDate.getTime()) {
    throw new Error('startDate não pode ser maior que endDate')
  }

  // Filtra TRANSFER por defesa em profundidade (caller já deve ter filtrado no SQL).
  // Também filtra dreGroup='TRANSFERENCIA' (categoria "Transferências" criada
  // pelo backfill): mesmo que type seja CREDIT/DEBIT, é movimentação interna
  // entre contas do mesmo dono — não infla receita/despesa.
  const filtered = transactions.filter(
    (t) => t.type !== 'TRANSFER' && t.dreGroup !== 'TRANSFERENCIA',
  )

  // Bucketing: agrupa por chave (string) preservando bucketStart/bucketEnd
  const buckets = new Map<
    string,
    { bucketStart: Date; bucketEnd: Date; income: number; expense: number; count: number }
  >()

  let totalIncome = 0
  let totalExpense = 0
  let totalCount = 0

  for (const tx of filtered) {
    const txMs = tx.date.getTime()
    // Filtra ao range (defensivo — caller deveria ter filtrado)
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

    if (tx.type === 'CREDIT') {
      existing.income += tx.amount
      totalIncome += tx.amount
    } else if (tx.type === 'DEBIT') {
      existing.expense += tx.amount
      totalExpense += tx.amount
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
    companyId,
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

// ============================================================
// Bucketing utility (locale BR: semana começa SEGUNDA)
// ============================================================

export function bucketFor(
  date: Date,
  groupBy: CashflowGroupBy,
): { bucketStart: Date; bucketEnd: Date } {
  if (groupBy === 'day') {
    const start = startOfDayUTC(date)
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1)
    return { bucketStart: start, bucketEnd: end }
  }
  if (groupBy === 'week') {
    const start = startOfWeekMondayUTC(date)
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000 - 1)
    return { bucketStart: start, bucketEnd: end }
  }
  // month
  const start = startOfMonthUTC(date)
  const end = endOfMonthUTC(date)
  return { bucketStart: start, bucketEnd: end }
}

function startOfDayUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

// Semana começa SEGUNDA (locale BR). getUTCDay(): 0=domingo, 1=segunda...6=sábado.
function startOfWeekMondayUTC(d: Date): Date {
  const day = d.getUTCDay()
  const daysSinceMonday = day === 0 ? 6 : day - 1
  const start = startOfDayUTC(d)
  start.setUTCDate(start.getUTCDate() - daysSinceMonday)
  return start
}

function startOfMonthUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
}

function endOfMonthUTC(d: Date): Date {
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
  return new Date(next.getTime() - 1)
}
