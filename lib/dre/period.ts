// Helpers de cálculo de períodos pra DRE (Sub-etapa 5.4.A).
// Sem dependências externas (zero date-fns) — projeto não usa.

import type { DREPeriod, ComparisonType } from './types'

// Calcula período de comparação dado o período atual e tipo.
// Retorna null pra 'none' e 'custom' (custom é resolvido fora pelo caller
// porque depende de input do usuário).
export function calculateComparisonPeriod(
  current: DREPeriod,
  type: ComparisonType,
): DREPeriod | null {
  if (type === 'none' || type === 'custom') return null

  const start = new Date(current.startDate)
  const end = new Date(current.endDate)

  switch (type) {
    case 'previous_period': {
      // Período de mesma duração imediatamente anterior.
      // O fim do período anterior é 1 ms antes do início do atual; o início
      // recua a duração do período atual a partir desse fim.
      const durationMs = end.getTime() - start.getTime()
      const prevEnd = new Date(start.getTime() - 1)
      const prevStart = new Date(prevEnd.getTime() - durationMs)
      return {
        startDate: prevStart,
        endDate: prevEnd,
        regime: current.regime,
      }
    }

    case 'same_period_last_year': {
      // Mesmo período mas 1 ano antes (preserva mês/dia/hora).
      const prevStart = new Date(start)
      prevStart.setFullYear(prevStart.getFullYear() - 1)
      const prevEnd = new Date(end)
      prevEnd.setFullYear(prevEnd.getFullYear() - 1)
      return {
        startDate: prevStart,
        endDate: prevEnd,
        regime: current.regime,
      }
    }

    case 'previous_year': {
      // Ano completo anterior (independente do período atual).
      const year = start.getFullYear() - 1
      return {
        startDate: new Date(year, 0, 1, 0, 0, 0, 0),
        endDate: new Date(year, 11, 31, 23, 59, 59, 999),
        regime: current.regime,
      }
    }

    case 'ytd_vs_ytd': {
      // YTD = início do ano até endDate.
      // Comparação = mesmo intervalo (1º de janeiro até endDate-1ano) do ano anterior.
      const yearAgoEnd = new Date(end)
      yearAgoEnd.setFullYear(yearAgoEnd.getFullYear() - 1)
      const yearStart = new Date(yearAgoEnd.getFullYear(), 0, 1, 0, 0, 0, 0)
      return {
        startDate: yearStart,
        endDate: yearAgoEnd,
        regime: current.regime,
      }
    }

    default:
      return null
  }
}

// Valida que período é coerente.
export function isValidPeriod(period: DREPeriod): boolean {
  if (isNaN(period.startDate.getTime())) return false
  if (isNaN(period.endDate.getTime())) return false
  if (period.startDate.getTime() > period.endDate.getTime()) return false
  return true
}

// Formata período em label legível BR.
export function formatPeriodLabel(period: DREPeriod): string {
  const start = period.startDate
  const end = period.endDate

  // Mesmo dia
  if (
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate()
  ) {
    return formatDateBR(start)
  }

  // Ano completo: 01/01/YYYY a 31/12/YYYY
  if (
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === 0 &&
    start.getDate() === 1 &&
    end.getMonth() === 11 &&
    end.getDate() === 31
  ) {
    return String(start.getFullYear())
  }

  // Mês completo: 1º dia até último dia do mesmo mês
  if (
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === 1 &&
    end.getDate() === lastDayOfMonth(end)
  ) {
    return `${MONTH_NAMES[start.getMonth()]} ${start.getFullYear()}`
  }

  // Custom: "01/01/2026 a 31/03/2026"
  return `${formatDateBR(start)} a ${formatDateBR(end)}`
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function formatDateBR(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `${day}/${month}/${d.getFullYear()}`
}

function lastDayOfMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}
