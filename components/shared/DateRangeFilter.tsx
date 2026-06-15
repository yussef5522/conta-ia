// Componente compartilhado de filtro de data — Sprint Filtro de Data Parte A.
// Sprint Visual (15/06/2026): UPGRADE pra botão + popover (2 colunas).
//   - Esquerda: 7 presets (sentence case)
//   - Direita: 2 inputs De/Até + Calendar com range
// Cores via tokens do design system (primary roxo do app).

'use client'

import * as React from 'react'
import { Calendar as CalendarIcon, ChevronDown, Check } from 'lucide-react'
import type { DateRange } from 'react-day-picker'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import {
  rangeForPreset,
  type DateRange as DateRangeInput,
  type PresetId,
} from '@/lib/hooks/use-date-range-filter'

// Visual: 7 presets (incl 'ontem' local + 'custom' como modo "Personalizado").
type VisualPresetId = PresetId | 'ontem' | 'todos' | 'custom'

interface Props {
  value: DateRangeInput
  onChange: (range: DateRangeInput) => void
  /** Label semântica do campo filtrado (mostrada no canto superior do popover). */
  label?: string
  /** Nome semântico da coluna do banco (cosmético; não muda comportamento). */
  dateField?: 'date' | 'dueDate' | 'paymentDate'
  /** Default selecionado quando nem inicio nem fim estão preenchidos. */
  defaultPreset?: VisualPresetId
}

const PRESETS: Array<{ id: VisualPresetId; label: string }> = [
  { id: 'hoje', label: 'Hoje' },
  { id: 'ontem', label: 'Ontem' },
  { id: 'ultimos-7d', label: 'Últimos 7 dias' },
  { id: 'ultimos-30d', label: 'Últimos 30 dias' },
  { id: 'mes-atual', label: 'Este mês' },
  { id: 'mes-passado', label: 'Mês passado' },
  { id: 'custom', label: 'Personalizado' },
]

// Helper local pra "ontem" (não existe em rangeForPreset; calculamos aqui).
function rangeOntem(today = new Date()): DateRangeInput {
  const y = today.getUTCFullYear()
  const m = today.getUTCMonth()
  const d = today.getUTCDate()
  const ontem = new Date(Date.UTC(y, m, d - 1))
  const iso = ontem.toISOString().slice(0, 10)
  return { inicio: iso, fim: iso }
}

function resolvePreset(id: VisualPresetId): DateRangeInput {
  if (id === 'todos' || id === 'custom') return { inicio: '', fim: '' }
  if (id === 'ontem') return rangeOntem()
  return rangeForPreset(id)
}

function detectPreset(range: DateRangeInput): VisualPresetId {
  if (!range.inicio && !range.fim) return 'todos'
  for (const p of PRESETS) {
    if (p.id === 'custom') continue
    const r = resolvePreset(p.id)
    if (r.inicio === range.inicio && r.fim === range.fim) return p.id
  }
  return 'custom'
}

function formatRange(value: DateRangeInput): string {
  if (!value.inicio && !value.fim) return 'Selecionar período'
  const fmt = (iso: string) => {
    if (!iso) return ''
    const d = new Date(iso + 'T12:00:00Z')
    const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
    return `${d.getUTCDate()} ${months[d.getUTCMonth()]}`
  }
  if (value.inicio && value.fim) {
    if (value.inicio === value.fim) return fmt(value.inicio)
    return `${fmt(value.inicio)} – ${fmt(value.fim)}`
  }
  return fmt(value.inicio || value.fim)
}

// Converte ISO YYYY-MM-DD <-> Date pro react-day-picker (UTC midday pra evitar TZ drift).
function isoToDate(iso: string): Date | undefined {
  if (!iso) return undefined
  return new Date(iso + 'T12:00:00Z')
}
function dateToIso(d: Date | undefined): string {
  if (!d) return ''
  return d.toISOString().slice(0, 10)
}

export function DateRangeFilter({ value, onChange, label = 'Período' }: Props) {
  const [open, setOpen] = React.useState(false)
  const selectedPreset = React.useMemo(() => detectPreset(value), [value])
  const hasValue = !!(value.inicio || value.fim)

  const dpRange: DateRange | undefined = React.useMemo(() => {
    if (!value.inicio && !value.fim) return undefined
    return {
      from: isoToDate(value.inicio) ?? undefined,
      to: isoToDate(value.fim) ?? undefined,
    }
  }, [value.inicio, value.fim])

  function applyPreset(id: VisualPresetId) {
    if (id === 'custom') return
    if (id === 'todos') {
      onChange({ inicio: '', fim: '' })
      setOpen(false)
      return
    }
    onChange(resolvePreset(id))
    setOpen(false)
  }

  function applyCalendar(range: DateRange | undefined) {
    if (!range) {
      onChange({ inicio: '', fim: '' })
      return
    }
    const inicio = dateToIso(range.from)
    const fim = dateToIso(range.to)
    onChange({ inicio, fim })
    if (range.from && range.to) {
      setOpen(false)
    }
  }

  function applyInputs(field: 'inicio' | 'fim', v: string) {
    const next = { ...value, [field]: v }
    // Garante inicio <= fim
    if (next.inicio && next.fim && next.inicio > next.fim) {
      onChange(field === 'inicio' ? { inicio: v, fim: v } : { inicio: v, fim: v })
      return
    }
    onChange(next)
  }

  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              'h-8 justify-start gap-2 text-sm font-normal pl-3 pr-2',
              hasValue && 'bg-primary/10 border-primary/40 text-primary hover:bg-primary/15 hover:text-primary',
            )}
          >
            <CalendarIcon className="size-3.5" />
            <span>{formatRange(value)}</span>
            <ChevronDown className="size-3.5 opacity-60 ml-1" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex">
            <div className="w-[180px] border-r p-2 space-y-0.5">
              {PRESETS.map((p) => {
                const active = selectedPreset === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p.id)}
                    className={cn(
                      'w-full text-left text-sm px-3 py-1.5 rounded-md flex items-center justify-between gap-2 transition-colors',
                      active
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'hover:bg-accent',
                    )}
                  >
                    <span>{p.label}</span>
                    {active && <Check className="size-3.5 text-primary" />}
                  </button>
                )
              })}
            </div>
            <div className="p-3 space-y-3">
              <div className="flex items-end gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">De</Label>
                  <Input
                    type="date"
                    className="h-8 w-32 text-sm"
                    value={value.inicio}
                    onChange={(e) => applyInputs('inicio', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Até</Label>
                  <Input
                    type="date"
                    className="h-8 w-32 text-sm"
                    value={value.fim}
                    onChange={(e) => applyInputs('fim', e.target.value)}
                  />
                </div>
              </div>
              <Calendar
                mode="range"
                numberOfMonths={1}
                selected={dpRange}
                onSelect={applyCalendar}
                defaultMonth={isoToDate(value.inicio) ?? new Date()}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
