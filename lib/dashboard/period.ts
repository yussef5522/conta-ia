// Períodos derivados pra Dashboard Hero KPIs — Sprint 1 Dia 1.
// Trabalha em UTC pra consistência com queries Prisma e testes.

export interface DateRange {
  start: Date
  end: Date
}

export interface DashboardPeriods {
  currentMonth: DateRange
  previousMonth: DateRange
  last30Days: DateRange
  last12Months: DateRange
}

// Início do mês UTC, hora 0
function startOfMonthUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
}

// Fim do mês UTC (último ms do último dia)
function endOfMonthUTC(d: Date): Date {
  const nextMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
  return new Date(nextMonth.getTime() - 1)
}

// Mês anterior preservando edge cases (jan → dez/ano anterior).
function previousMonthOf(d: Date): { start: Date; end: Date } {
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1))
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) - 1)
  return { start, end }
}

// Calcula os 4 ranges derivados de uma data de referência (default: hoje).
// Importante: end de last30Days e last12Months = endOfMonthUTC(refDate),
// pra incluir o dia/mês corrente completo nos buckets de sparkline.
export function derivePeriods(refDate: Date = new Date()): DashboardPeriods {
  const currentMonth = {
    start: startOfMonthUTC(refDate),
    end: endOfMonthUTC(refDate),
  }
  const previousMonth = previousMonthOf(refDate)

  // last30Days: 30 dias contando o dia da refDate (inclusivo) → start = refDate - 29 dias (00h UTC)
  const last30Start = new Date(
    Date.UTC(refDate.getUTCFullYear(), refDate.getUTCMonth(), refDate.getUTCDate() - 29),
  )
  const last30End = new Date(
    Date.UTC(refDate.getUTCFullYear(), refDate.getUTCMonth(), refDate.getUTCDate() + 1) - 1,
  )

  // last12Months: 12 meses contando o mês da refDate (inclusivo).
  // start = primeiro dia do mês (refDate.month - 11).
  const last12Start = new Date(
    Date.UTC(refDate.getUTCFullYear(), refDate.getUTCMonth() - 11, 1),
  )
  const last12End = endOfMonthUTC(refDate)

  return {
    currentMonth,
    previousMonth,
    last30Days: { start: last30Start, end: last30End },
    last12Months: { start: last12Start, end: last12End },
  }
}

// ============================================================
// Range pro Cashflow Waterfall — Sprint 2 Dia 1
// ============================================================

export type WaterfallPeriodType = 'semana' | 'mes' | 'trimestre' | 'ano'

// Calcula o range [start, end] de um período pro waterfall.
//   semana    → segunda a domingo da semana da refDate (locale BR: começa segunda)
//   mes       → mês corrente completo
//   trimestre → trimestre civil corrente (jan-mar, abr-jun, jul-set, out-dez)
//   ano       → ano civil corrente
export function deriveWaterfallRange(
  periodType: WaterfallPeriodType,
  refDate: Date = new Date(),
): DateRange {
  const y = refDate.getUTCFullYear()
  const m = refDate.getUTCMonth()
  const d = refDate.getUTCDate()

  if (periodType === 'semana') {
    // Segunda como início (getUTCDay: 0=dom...6=sáb)
    const day = refDate.getUTCDay()
    const daysSinceMonday = day === 0 ? 6 : day - 1
    const start = new Date(Date.UTC(y, m, d - daysSinceMonday))
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000 - 1)
    return { start, end }
  }

  if (periodType === 'trimestre') {
    const quarterStartMonth = Math.floor(m / 3) * 3
    const start = new Date(Date.UTC(y, quarterStartMonth, 1))
    const end = new Date(Date.UTC(y, quarterStartMonth + 3, 1) - 1)
    return { start, end }
  }

  if (periodType === 'ano') {
    const start = new Date(Date.UTC(y, 0, 1))
    const end = new Date(Date.UTC(y + 1, 0, 1) - 1)
    return { start, end }
  }

  // 'mes' (default)
  return {
    start: startOfMonthUTC(refDate),
    end: endOfMonthUTC(refDate),
  }
}
