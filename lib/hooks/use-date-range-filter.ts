// Hook compartilhado de filtro de data: lê e escreve ?inicio=&fim= na URL.
// Convenção única do projeto pra páginas de listagem (Sprint Filtro de Data Parte A).
//
// Páginas: /pendentes, /conciliacao, /transferencias (+ futuras).
// Relatórios usam ?startDate=&endDate= e PeriodSelector próprio (decisão Parte B).
//
// O filtro PERSISTE no F5 e é compartilhável via URL.

'use client'

import { useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export interface DateRange {
  inicio: string // ISO YYYY-MM-DD (ou string vazia)
  fim: string
}

export interface UseDateRangeFilterReturn extends DateRange {
  setRange: (range: Partial<DateRange>) => void
  setInicio: (v: string) => void
  setFim: (v: string) => void
  clear: () => void
}

/**
 * Lê inicio/fim da URL e expõe setters que sincronizam de volta na URL
 * via router.replace (não polui histórico). Default = strings vazias.
 *
 * Próximo F5 ou navegação de volta = filtro preservado.
 */
export function useDateRangeFilter(): UseDateRangeFilterReturn {
  const router = useRouter()
  const searchParams = useSearchParams()

  const inicio = searchParams.get('inicio') ?? ''
  const fim = searchParams.get('fim') ?? ''

  const setRange = useCallback(
    (range: Partial<DateRange>) => {
      const next = new URLSearchParams(searchParams.toString())
      const nextInicio = range.inicio !== undefined ? range.inicio : inicio
      const nextFim = range.fim !== undefined ? range.fim : fim
      if (nextInicio) next.set('inicio', nextInicio)
      else next.delete('inicio')
      if (nextFim) next.set('fim', nextFim)
      else next.delete('fim')
      const qs = next.toString()
      router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false })
    },
    [router, searchParams, inicio, fim],
  )

  const setInicio = useCallback((v: string) => setRange({ inicio: v }), [setRange])
  const setFim = useCallback((v: string) => setRange({ fim: v }), [setRange])
  const clear = useCallback(() => setRange({ inicio: '', fim: '' }), [setRange])

  return { inicio, fim, setInicio, setFim, setRange, clear }
}

/**
 * Cálculo PURO dos presets (sem React/window). Reutilizável em testes.
 * Retorna intervalos ISO YYYY-MM-DD inclusive.
 */
export type PresetId =
  | 'hoje'
  | 'ultimos-7d'
  | 'ultimos-30d'
  | 'mes-atual'
  | 'mes-passado'

export function rangeForPreset(preset: PresetId, today: Date = new Date()): DateRange {
  const y = today.getUTCFullYear()
  const m = today.getUTCMonth()
  const d = today.getUTCDate()
  const iso = (dt: Date) => dt.toISOString().slice(0, 10)
  const todayUtc = new Date(Date.UTC(y, m, d))

  if (preset === 'hoje') {
    return { inicio: iso(todayUtc), fim: iso(todayUtc) }
  }
  if (preset === 'ultimos-7d') {
    const start = new Date(Date.UTC(y, m, d - 6))
    return { inicio: iso(start), fim: iso(todayUtc) }
  }
  if (preset === 'ultimos-30d') {
    const start = new Date(Date.UTC(y, m, d - 29))
    return { inicio: iso(start), fim: iso(todayUtc) }
  }
  if (preset === 'mes-atual') {
    const start = new Date(Date.UTC(y, m, 1))
    const end = new Date(Date.UTC(y, m + 1, 0))
    return { inicio: iso(start), fim: iso(end) }
  }
  if (preset === 'mes-passado') {
    const start = new Date(Date.UTC(y, m - 1, 1))
    const end = new Date(Date.UTC(y, m, 0))
    return { inicio: iso(start), fim: iso(end) }
  }
  return { inicio: '', fim: '' }
}
