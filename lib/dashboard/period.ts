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
