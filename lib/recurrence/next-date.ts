// Sprint 4.0.1.b — cálculo de próximas datas de geração.
// Função PURA: dado um schedule e referenceDate, retorna as próximas N dueDates
// que cairiam na janela de geração.
//
// Não toca DB. Não chama nada externo. Testável trivialmente.

export type Frequency = 'MONTHLY' | 'WEEKLY' | 'QUARTERLY' | 'YEARLY'

export interface RecurrenceConfig {
  frequency: Frequency
  dayOfMonth: number | null
  dayOfWeek: number | null
  startDate: Date
  endDate: Date | null
}

// Normaliza data pra meia-noite UTC (descarta horário) — todos os cálculos de
// dueDate operam em "dia inteiro" sem ambiguidade de fuso.
function startOfDayUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function addDays(d: Date, days: number): Date {
  const result = new Date(d.getTime())
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

// Soma `months` em uma data, ajustando dia se mês destino tem menos dias
// (31 de janeiro + 1 mês = 28/29 de fevereiro).
function addMonths(d: Date, months: number, targetDay: number): Date {
  const year = d.getUTCFullYear()
  const month = d.getUTCMonth() + months
  const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const day = Math.min(targetDay, lastDayOfMonth)
  return new Date(Date.UTC(year, month, day))
}

/**
 * Calcula próximas `count` dueDates a partir de `referenceDate` (inclusive)
 * dentro da vigência [startDate, endDate].
 *
 * Retorna array vazio se:
 *   - referenceDate > endDate (schedule encerrado)
 *   - count = 0
 *   - configuração inválida (ex: MONTHLY sem dayOfMonth)
 */
export function calculateNextDueDates(
  config: RecurrenceConfig,
  referenceDate: Date,
  count: number,
): Date[] {
  if (count <= 0) return []
  if (config.endDate && referenceDate > config.endDate) return []

  const result: Date[] = []
  const ref = startOfDayUTC(referenceDate)
  const start = startOfDayUTC(config.startDate)

  // Ponto de partida: o maior entre start e ref
  const cursor = start.getTime() > ref.getTime() ? start : ref

  switch (config.frequency) {
    case 'MONTHLY': {
      if (config.dayOfMonth == null || config.dayOfMonth < 1 || config.dayOfMonth > 31) {
        return []
      }
      let candidate = monthlyCandidateAtOrAfter(cursor, config.dayOfMonth, start)
      while (result.length < count) {
        if (config.endDate && candidate > config.endDate) break
        result.push(candidate)
        candidate = addMonths(candidate, 1, config.dayOfMonth)
      }
      break
    }

    case 'QUARTERLY': {
      if (config.dayOfMonth == null || config.dayOfMonth < 1 || config.dayOfMonth > 31) {
        return []
      }
      // Trimestres ancorados no MÊS de startDate (ex: start=jan → gera jan, abr, jul, out)
      const startMonth = start.getUTCMonth()
      let candidate = quarterlyCandidateAtOrAfter(cursor, config.dayOfMonth, startMonth, start)
      while (result.length < count) {
        if (config.endDate && candidate > config.endDate) break
        result.push(candidate)
        candidate = addMonths(candidate, 3, config.dayOfMonth)
      }
      break
    }

    case 'YEARLY': {
      if (config.dayOfMonth == null) return []
      // YEARLY usa mês de startDate + dayOfMonth
      const startMonth = start.getUTCMonth()
      let year = Math.max(start.getUTCFullYear(), cursor.getUTCFullYear())
      let candidate = yearlyCandidate(year, startMonth, config.dayOfMonth)
      if (candidate < cursor) {
        year++
        candidate = yearlyCandidate(year, startMonth, config.dayOfMonth)
      }
      while (result.length < count) {
        if (config.endDate && candidate > config.endDate) break
        result.push(candidate)
        year++
        candidate = yearlyCandidate(year, startMonth, config.dayOfMonth)
      }
      break
    }

    case 'WEEKLY': {
      if (config.dayOfWeek == null || config.dayOfWeek < 0 || config.dayOfWeek > 6) {
        return []
      }
      // Caminha 0..6 dias do cursor até bater no dayOfWeek alvo
      let candidate = startOfDayUTC(cursor)
      while (candidate.getUTCDay() !== config.dayOfWeek) {
        candidate = addDays(candidate, 1)
      }
      while (result.length < count) {
        if (config.endDate && candidate > config.endDate) break
        result.push(candidate)
        candidate = addDays(candidate, 7)
      }
      break
    }
  }

  return result
}

function monthlyCandidateAtOrAfter(cursor: Date, day: number, start: Date): Date {
  const year = cursor.getUTCFullYear()
  const month = cursor.getUTCMonth()
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const targetDay = Math.min(day, lastDay)
  let candidate = new Date(Date.UTC(year, month, targetDay))
  // Se já passou no mês atual OU é antes do start, vai pro próximo mês
  if (candidate < cursor || candidate < start) {
    candidate = addMonths(candidate, 1, day)
  }
  return candidate
}

function quarterlyCandidateAtOrAfter(
  cursor: Date,
  day: number,
  startMonth: number,
  start: Date,
): Date {
  // Trimestres válidos: startMonth, startMonth+3, startMonth+6, startMonth+9 (mod 12)
  // Encontra o mais cedo que seja >= cursor e >= start.
  const year = cursor.getUTCFullYear()
  let bestCandidate: Date | null = null
  for (let offset = 0; offset < 12; offset += 3) {
    const m = (startMonth + offset) % 12
    const yearAdjusted = startMonth + offset >= 12 ? year + 1 : year
    const lastDay = new Date(Date.UTC(yearAdjusted, m + 1, 0)).getUTCDate()
    const targetDay = Math.min(day, lastDay)
    const candidate = new Date(Date.UTC(yearAdjusted, m, targetDay))
    if (candidate >= cursor && candidate >= start) {
      if (bestCandidate === null || candidate < bestCandidate) {
        bestCandidate = candidate
      }
    }
  }
  // Se nenhum no ano corrente serve, força no próximo ciclo do start
  if (bestCandidate === null) {
    const nextYearStart = new Date(Date.UTC(year + 1, startMonth, 1))
    const lastDay = new Date(Date.UTC(year + 1, startMonth + 1, 0)).getUTCDate()
    bestCandidate = new Date(Date.UTC(year + 1, startMonth, Math.min(day, lastDay)))
  }
  return bestCandidate
}

function yearlyCandidate(year: number, month: number, day: number): Date {
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  return new Date(Date.UTC(year, month, Math.min(day, lastDay)))
}
