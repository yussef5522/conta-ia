'use client'

// Sprint 7 — Seletor de período compacto único.
// [‹] [Junho 2026 ▼] [›] + toggle Caixa | Competência
// Menu flutuante absoluto (não empurra layout). URL: ?periodo=YYYY-MM ou
// ?de=&ate= (custom). Default = MTD.

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, ChevronDown, Calendar } from 'lucide-react'
import {
  addMonths,
  formatPeriodoYM,
  getCurrentMTD,
  isCurrentMonth,
  labelMesAno,
  parsePeriodoYM,
} from '@/lib/dashboard/period-sp'

interface PeriodSelectorProps {
  empresaId: string
  currentYear: number
  currentMonth: number // 0-11
  regime: 'caixa' | 'competencia'
  /** true se currentMonth/currentYear é o mês atual em SP */
  isMTD: boolean
}

export function PeriodSelector({
  currentYear,
  currentMonth,
  regime,
  isMTD,
}: PeriodSelectorProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Fecha menu ao clicar fora
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  function navTo(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(updates)) {
      if (v === null) params.delete(k)
      else params.set(k, v)
    }
    router.replace(`?${params.toString()}`, { scroll: false })
    setMenuOpen(false)
  }

  function goToMonth(y: number, m: number) {
    const now = new Date()
    if (isCurrentMonth(y, m, now)) {
      navTo({ periodo: null }) // mês atual = sem param (default)
    } else {
      navTo({ periodo: formatPeriodoYM(y, m) })
    }
  }

  function prev() {
    const { year, month } = addMonths(currentYear, currentMonth, -1)
    goToMonth(year, month)
  }
  function next() {
    if (isMTD) return // não vai pro futuro
    const { year, month } = addMonths(currentYear, currentMonth, 1)
    goToMonth(year, month)
  }

  function setRegime(r: 'caixa' | 'competencia') {
    navTo({ regime: r === 'caixa' ? null : 'competencia' })
  }

  // Menu actions
  const now = new Date()
  const cur = getCurrentMTD(now)
  const last = addMonths(cur.year, cur.month, -1)

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Period stepper */}
      <div className="inline-flex items-center rounded-md border bg-background h-8">
        <button
          type="button"
          onClick={prev}
          className="px-2 h-full text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors rounded-l-md"
          aria-label="Mês anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-1.5 px-3 h-8 text-sm font-medium hover:bg-muted/40 transition-colors border-x"
          >
            {labelMesAno(currentYear, currentMonth)}
            {isMTD && (
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                até hoje
              </span>
            )}
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          {menuOpen && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 w-56 rounded-md border bg-popover text-popover-foreground shadow-lg overflow-hidden">
              <button
                type="button"
                onClick={() => goToMonth(cur.year, cur.month)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex items-center justify-between"
              >
                <span>Este mês</span>
                <span className="text-xs text-muted-foreground">
                  {labelMesAno(cur.year, cur.month)}
                </span>
              </button>
              <button
                type="button"
                onClick={() => goToMonth(last.year, last.month)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex items-center justify-between"
              >
                <span>Mês passado</span>
                <span className="text-xs text-muted-foreground">
                  {labelMesAno(last.year, last.month)}
                </span>
              </button>
              <div className="border-t my-1" />
              <CustomMonthPicker
                onPick={(y, m) => goToMonth(y, m)}
                currentYear={currentYear}
                currentMonth={currentMonth}
              />
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={next}
          disabled={isMTD}
          className="px-2 h-full text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors rounded-r-md disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed"
          aria-label="Próximo mês"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Regime toggle */}
      <div className="inline-flex items-center rounded-md border bg-background h-8 text-xs">
        <button
          type="button"
          onClick={() => setRegime('caixa')}
          className={`px-2.5 h-full rounded-l-md transition-colors ${regime === 'caixa' ? 'bg-foreground text-background font-medium' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Caixa
        </button>
        <button
          type="button"
          onClick={() => setRegime('competencia')}
          className={`px-2.5 h-full rounded-r-md transition-colors ${regime === 'competencia' ? 'bg-foreground text-background font-medium' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Competência
        </button>
      </div>
    </div>
  )
}

function CustomMonthPicker({
  onPick,
  currentYear,
}: {
  onPick: (y: number, m: number) => void
  currentYear: number
  currentMonth: number
}) {
  const [year, setYear] = useState(currentYear)
  const now = new Date()
  const cur = getCurrentMTD(now)

  return (
    <div className="px-2 py-2">
      <div className="flex items-center justify-between mb-1.5 px-1">
        <button
          type="button"
          onClick={() => setYear((y) => y - 1)}
          className="text-xs text-muted-foreground hover:text-foreground p-0.5"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <div className="text-xs font-medium flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {year}
        </div>
        <button
          type="button"
          onClick={() => setYear((y) => y + 1)}
          disabled={year >= cur.year}
          className="text-xs text-muted-foreground hover:text-foreground p-0.5 disabled:opacity-30"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'].map((nome, idx) => {
          const isFuture = year > cur.year || (year === cur.year && idx > cur.month)
          return (
            <button
              key={nome}
              type="button"
              onClick={() => !isFuture && onPick(year, idx)}
              disabled={isFuture}
              className={`text-xs py-1.5 rounded transition-colors ${
                isFuture
                  ? 'opacity-30 cursor-not-allowed'
                  : 'hover:bg-muted'
              }`}
            >
              {nome}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// helper sem dependência só pra parse no server caller (re-export)
export { parsePeriodoYM }
