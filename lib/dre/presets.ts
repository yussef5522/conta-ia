// Helpers de presets de período pra DRE (Sub-etapa 5.4.B).

export type PeriodPreset =
  | 'current_month'
  | 'previous_month'
  | 'current_quarter'
  | 'current_year'
  | 'previous_year'
  | 'last_30_days'
  | 'last_90_days'
  | 'custom'

export const PRESET_LABELS: Record<PeriodPreset, string> = {
  current_month: 'Mês Atual',
  previous_month: 'Mês Anterior',
  current_quarter: 'Trimestre Atual',
  current_year: 'Ano Atual (YTD)',
  previous_year: 'Ano Anterior',
  last_30_days: 'Últimos 30 dias',
  last_90_days: 'Últimos 90 dias',
  custom: 'Período Personalizado',
}

export const PRESET_ORDER: PeriodPreset[] = [
  'current_month',
  'previous_month',
  'current_quarter',
  'current_year',
  'previous_year',
  'last_30_days',
  'last_90_days',
  'custom',
]

// Calcula início e fim baseado no preset.
// `today` aceitável pra testes; default é o agora local.
export function calculatePresetDates(
  preset: PeriodPreset,
  today: Date = new Date(),
): { startDate: Date; endDate: Date } {
  const year = today.getFullYear()
  const month = today.getMonth()

  switch (preset) {
    case 'current_month': {
      const start = new Date(year, month, 1, 0, 0, 0, 0)
      const end = new Date(year, month + 1, 0, 23, 59, 59, 999)
      return { startDate: start, endDate: end }
    }

    case 'previous_month': {
      const start = new Date(year, month - 1, 1, 0, 0, 0, 0)
      const end = new Date(year, month, 0, 23, 59, 59, 999)
      return { startDate: start, endDate: end }
    }

    case 'current_quarter': {
      const quarter = Math.floor(month / 3)
      const start = new Date(year, quarter * 3, 1, 0, 0, 0, 0)
      const end = new Date(year, quarter * 3 + 3, 0, 23, 59, 59, 999)
      return { startDate: start, endDate: end }
    }

    case 'current_year': {
      const start = new Date(year, 0, 1, 0, 0, 0, 0)
      const end = new Date(year, 11, 31, 23, 59, 59, 999)
      return { startDate: start, endDate: end }
    }

    case 'previous_year': {
      const start = new Date(year - 1, 0, 1, 0, 0, 0, 0)
      const end = new Date(year - 1, 11, 31, 23, 59, 59, 999)
      return { startDate: start, endDate: end }
    }

    case 'last_30_days': {
      const end = new Date(today.getTime())
      end.setHours(23, 59, 59, 999)
      const start = new Date(today.getTime())
      start.setDate(start.getDate() - 30)
      start.setHours(0, 0, 0, 0)
      return { startDate: start, endDate: end }
    }

    case 'last_90_days': {
      const end = new Date(today.getTime())
      end.setHours(23, 59, 59, 999)
      const start = new Date(today.getTime())
      start.setDate(start.getDate() - 90)
      start.setHours(0, 0, 0, 0)
      return { startDate: start, endDate: end }
    }

    case 'custom':
    default: {
      // Fallback seguro: mês atual
      const start = new Date(year, month, 1, 0, 0, 0, 0)
      const end = new Date(year, month + 1, 0, 23, 59, 59, 999)
      return { startDate: start, endDate: end }
    }
  }
}

// Detecta qual preset corresponde a um par de datas (ou retorna 'custom').
// Compara só ano/mês/dia (não horário) pra tolerar arredondamento ISO.
export function detectPreset(
  startDate: Date,
  endDate: Date,
  today: Date = new Date(),
): PeriodPreset {
  for (const preset of PRESET_ORDER) {
    if (preset === 'custom') continue
    const dates = calculatePresetDates(preset, today)
    if (sameDay(dates.startDate, startDate) && sameDay(dates.endDate, endDate)) {
      return preset
    }
  }
  return 'custom'
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}
