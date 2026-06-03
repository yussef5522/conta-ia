// Sprint Dashboard PF — Tipos compartilhados.

export interface MonthlyEvolutionPoint {
  // YYYY-MM (ex: "2026-05")
  month: string
  // Entradas (CREDIT) do mês
  income: number
  // Saídas (DEBIT) do mês
  expense: number
  // Net = income - expense
  net: number
  // Saldo cumulativo até o fim do mês (calculado externamente)
  cumulativeBalance: number
  // Label legível pra UI (ex: "Mai/26")
  label: string
}

export interface MonthlyEvolutionResult {
  months: MonthlyEvolutionPoint[]
  /** Saldo final no último mês — útil pra Hero. */
  finalBalance: number
  /** Maior valor pra escala do gráfico. */
  maxIncome: number
  maxExpense: number
}

export interface DashboardSummary {
  // Hero
  saldoTotal: number
  entradasMes: number
  saidasMes: number
  resultadoMes: number
  saldoPrevisto30d: number
  // Despesas por categoria (top 8)
  topExpenses: Array<{
    categoryId: string | null
    name: string
    color: string | null
    total: number
    percent: number
  }>
  // Diferenciais
  bridgeIncomeMes: number
  bridgeCountMes: number
  recurringMonthly: number
  recurringCount: number
  // Recent
  recentTransactionsCount: number
}
