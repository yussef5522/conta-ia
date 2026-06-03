// Sprint Dashboard PF — Função pura: agregar tx por mês.
//
// Input: array de tx (CREDIT/DEBIT) + N de meses + saldo atual.
// Output: array de N pontos (do mais antigo pro mais recente) com
// entradas/saídas/net/saldo cumulativo.
//
// Usado pelo MonthlyEvolutionChart (12 meses). Saldo cumulativo é
// calculado retrocedendo a partir do saldoAtual (mesma técnica do
// Hero do PJ — Sprint 1 Dia 1).

import type { MonthlyEvolutionPoint, MonthlyEvolutionResult } from './types'

export interface RawTx {
  date: Date
  amount: number
  // CREDIT = entrada (income), DEBIT = saída (expense)
  type: 'CREDIT' | 'DEBIT'
}

/** Pra reusar nomes consistentes em todas as agregações. */
const MES_LABELS = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
]

/**
 * Constrói N pontos mensais retrocedendo a partir de `referenceDate`.
 * Mais antigo no índice 0, mais recente no índice N-1.
 * Mês "atual" = mês de referenceDate.
 */
function buildEmptyPoints(months: number, referenceDate: Date): MonthlyEvolutionPoint[] {
  const out: MonthlyEvolutionPoint[] = []
  const refYear = referenceDate.getUTCFullYear()
  const refMonth = referenceDate.getUTCMonth() // 0-11
  for (let i = months - 1; i >= 0; i--) {
    // i meses atrás
    const targetMonth = refMonth - i
    let year = refYear
    let monthIndex = targetMonth
    while (monthIndex < 0) {
      monthIndex += 12
      year--
    }
    const m = monthIndex + 1
    const monthStr = `${year}-${m.toString().padStart(2, '0')}`
    const yy = (year % 100).toString().padStart(2, '0')
    out.push({
      month: monthStr,
      label: `${MES_LABELS[monthIndex]}/${yy}`,
      income: 0,
      expense: 0,
      net: 0,
      cumulativeBalance: 0,
    })
  }
  return out
}

export interface AggregateMonthlyInput {
  transactions: RawTx[]
  months: number
  /** Saldo atual (default: 0). Usado pra calcular cumulativeBalance retrocedendo. */
  currentBalance: number
  /** Data de referência (default: now). */
  referenceDate?: Date
}

export function aggregateMonthly(input: AggregateMonthlyInput): MonthlyEvolutionResult {
  const refDate = input.referenceDate ?? new Date()
  const points = buildEmptyPoints(input.months, refDate)

  // Index por monthStr (YYYY-MM) pra lookup O(1)
  const byMonth = new Map<string, MonthlyEvolutionPoint>()
  for (const p of points) byMonth.set(p.month, p)

  // Agrega tx em cada bucket
  for (const tx of input.transactions) {
    const d = tx.date
    const y = d.getUTCFullYear()
    const m = d.getUTCMonth() + 1
    const key = `${y}-${m.toString().padStart(2, '0')}`
    const bucket = byMonth.get(key)
    if (!bucket) continue // fora da janela
    if (tx.type === 'CREDIT') {
      bucket.income += tx.amount
    } else {
      bucket.expense += tx.amount
    }
  }

  // Calcula net + saldo cumulativo retrocedendo do saldo atual
  for (const p of points) {
    p.net = p.income - p.expense
  }

  // Cumulative: saldo no FIM do mês N = saldo no fim do mês N-1 + net(N).
  // Sabemos: saldo no fim do último mês = currentBalance.
  // Logo: saldo no fim do mês (último-1) = currentBalance - net(último).
  // E retrocede.
  let running = input.currentBalance
  for (let i = points.length - 1; i >= 0; i--) {
    points[i].cumulativeBalance = running
    running = running - points[i].net
  }

  let maxIncome = 0
  let maxExpense = 0
  for (const p of points) {
    if (p.income > maxIncome) maxIncome = p.income
    if (p.expense > maxExpense) maxExpense = p.expense
  }

  return {
    months: points,
    finalBalance: input.currentBalance,
    maxIncome,
    maxExpense,
  }
}
