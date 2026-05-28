// Hotfix 5.0.4.0c1-fix — Helpers de período pro PeriodSelector da Análise IA.
//
// Funções puras UTC sem deps externas. Cobre 7 presets + custom.

export interface PeriodRange {
  /** ISO YYYY-MM-DD */
  startDate: string
  endDate: string
}

export interface PresetResult extends PeriodRange {
  /** Period de comparação (opcional — só pra presets COMPARATIVE) */
  compareStartDate?: string
  compareEndDate?: string
}

export interface PresetDefinition {
  id: PresetId
  label: string
  icon: string
  description?: string
  /** Se true, gera comparePeriod (modo comparative) */
  isComparative: boolean
  compute: (now?: Date) => PresetResult
}

export type PresetId =
  | 'month-vs-prev'
  | 'month-vs-yoy'
  | 'quarter-vs-prev'
  | 'year-vs-prev'
  | 'last-3m'
  | 'last-6m'
  | 'last-12m'

// ============================================================
// Helpers UTC nativos (sem date-fns)
// ============================================================

export function startOfMonthUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
}

export function endOfMonthUTC(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59, 999),
  )
}

export function addMonthsUTC(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1))
}

export function subMonthsUTC(d: Date, n: number): Date {
  return addMonthsUTC(d, -n)
}

export function startOfQuarterUTC(d: Date): Date {
  const m = d.getUTCMonth()
  const q = Math.floor(m / 3) * 3
  return new Date(Date.UTC(d.getUTCFullYear(), q, 1))
}

export function endOfQuarterUTC(d: Date): Date {
  const s = startOfQuarterUTC(d)
  return new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + 3, 0, 23, 59, 59, 999))
}

export function startOfYearUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
}

export function endOfYearUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), 11, 31, 23, 59, 59, 999))
}

export function subYearsUTC(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear() - n, d.getUTCMonth(), d.getUTCDate()))
}

/** Retorna o número INTEIRO de meses entre 2 datas (end - start). Aceita meses fracionados arredondando pra baixo. */
export function differenceInMonthsUTC(end: Date, start: Date): number {
  const years = end.getUTCFullYear() - start.getUTCFullYear()
  const months = end.getUTCMonth() - start.getUTCMonth()
  // Ajuste fino: se dia do end < dia do start, subtrai 1
  let total = years * 12 + months
  if (end.getUTCDate() < start.getUTCDate()) total--
  return total
}

export function formatISODateUTC(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Aceita "YYYY-MM" (legacy) ou "YYYY-MM-DD" (novo).
 * "2026-05" → Date UTC 2026-05-01.
 */
export function parsePeriodInput(input: string): Date {
  if (/^\d{4}-\d{2}$/.test(input)) {
    return new Date(`${input}-01T00:00:00.000Z`)
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return new Date(`${input}T00:00:00.000Z`)
  }
  throw new Error(`Formato de período inválido: ${input}`)
}

// ============================================================
// Presets
// ============================================================

export const PRESETS: PresetDefinition[] = [
  {
    id: 'month-vs-prev',
    label: 'Mês atual vs Mês anterior',
    icon: '📅',
    isComparative: true,
    compute: (now = new Date()) => {
      const cur = startOfMonthUTC(now)
      const prev = subMonthsUTC(cur, 1)
      return {
        startDate: formatISODateUTC(cur),
        endDate: formatISODateUTC(endOfMonthUTC(cur)),
        compareStartDate: formatISODateUTC(prev),
        compareEndDate: formatISODateUTC(endOfMonthUTC(prev)),
      }
    },
  },
  {
    id: 'month-vs-yoy',
    label: 'Mês atual vs Mesmo mês ano anterior',
    icon: '🔄',
    description: 'Análise sazonal (YoY)',
    isComparative: true,
    compute: (now = new Date()) => {
      const cur = startOfMonthUTC(now)
      const yoy = subYearsUTC(cur, 1)
      return {
        startDate: formatISODateUTC(cur),
        endDate: formatISODateUTC(endOfMonthUTC(cur)),
        compareStartDate: formatISODateUTC(startOfMonthUTC(yoy)),
        compareEndDate: formatISODateUTC(endOfMonthUTC(yoy)),
      }
    },
  },
  {
    id: 'quarter-vs-prev',
    label: 'Trimestre atual vs Trimestre anterior',
    icon: '📊',
    isComparative: true,
    compute: (now = new Date()) => {
      const cur = startOfQuarterUTC(now)
      const prev = subMonthsUTC(cur, 3)
      return {
        startDate: formatISODateUTC(cur),
        endDate: formatISODateUTC(endOfQuarterUTC(cur)),
        compareStartDate: formatISODateUTC(startOfQuarterUTC(prev)),
        compareEndDate: formatISODateUTC(endOfQuarterUTC(prev)),
      }
    },
  },
  {
    id: 'year-vs-prev',
    label: 'Ano atual vs Ano anterior',
    icon: '📈',
    isComparative: true,
    compute: (now = new Date()) => {
      const cur = startOfYearUTC(now)
      const prev = subYearsUTC(cur, 1)
      return {
        startDate: formatISODateUTC(cur),
        endDate: formatISODateUTC(endOfYearUTC(cur)),
        compareStartDate: formatISODateUTC(startOfYearUTC(prev)),
        compareEndDate: formatISODateUTC(endOfYearUTC(prev)),
      }
    },
  },
  {
    id: 'last-3m',
    label: 'Últimos 3 meses',
    icon: '📆',
    description: 'Análise de tendência',
    isComparative: false,
    compute: (now = new Date()) => {
      const cur = startOfMonthUTC(now)
      const start = subMonthsUTC(cur, 2)
      return {
        startDate: formatISODateUTC(start),
        endDate: formatISODateUTC(endOfMonthUTC(cur)),
      }
    },
  },
  {
    id: 'last-6m',
    label: 'Últimos 6 meses',
    icon: '📆',
    description: 'Análise de tendência',
    isComparative: false,
    compute: (now = new Date()) => {
      const cur = startOfMonthUTC(now)
      const start = subMonthsUTC(cur, 5)
      return {
        startDate: formatISODateUTC(start),
        endDate: formatISODateUTC(endOfMonthUTC(cur)),
      }
    },
  },
  {
    id: 'last-12m',
    label: 'Últimos 12 meses',
    icon: '📆',
    description: 'Análise de tendência (limite máximo)',
    isComparative: false,
    compute: (now = new Date()) => {
      const cur = startOfMonthUTC(now)
      const start = subMonthsUTC(cur, 11)
      return {
        startDate: formatISODateUTC(start),
        endDate: formatISODateUTC(endOfMonthUTC(cur)),
      }
    },
  },
]

export function findPreset(id: string): PresetDefinition | undefined {
  return PRESETS.find((p) => p.id === id)
}

// ============================================================
// Mode inference
// ============================================================

export type InsightMode = 'comparative' | 'evolution' | 'single'

export interface InferModeInput {
  startDate: string
  endDate: string
  compareStartDate?: string | null
  compareEndDate?: string | null
}

/**
 * Infere modo automaticamente:
 * - comparative: ambos compareStartDate + compareEndDate presentes
 * - evolution: período principal >= 3 meses (não cumulativo, mas duração total)
 * - single: período principal < 3 meses, sem comparison
 */
export function inferMode(input: InferModeInput): InsightMode {
  if (input.compareStartDate && input.compareEndDate) {
    return 'comparative'
  }
  const start = parsePeriodInput(input.startDate)
  const end = parsePeriodInput(input.endDate)
  const months = differenceInMonthsUTC(end, start)
  // >= 2 meses de diferença significa "abrange 3 meses civis" no min
  // (start=Mar/01, end=Mai/30: diff=2, abrange Mar/Abr/Mai)
  if (months >= 2) return 'evolution'
  return 'single'
}

/**
 * Valida que período principal é <= 12 meses (controle de custo).
 * Aplicado em frontend (alerta UX) e backend (segurança).
 */
export function validatePeriodLimit(
  startDate: string,
  endDate: string,
  maxMonths = 12,
): { ok: true } | { ok: false; error: string; months: number } {
  const start = parsePeriodInput(startDate)
  const end = parsePeriodInput(endDate)
  if (end.getTime() <= start.getTime()) {
    return { ok: false, error: 'Data final precisa ser depois da inicial.', months: 0 }
  }
  const months = differenceInMonthsUTC(end, start) + 1 // +1 inclusive
  if (months > maxMonths) {
    return {
      ok: false,
      error: `Período máximo é ${maxMonths} meses (controle de custo). Selecionou ${months}.`,
      months,
    }
  }
  return { ok: true }
}
