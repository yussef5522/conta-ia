// Componente compartilhado de filtro de data.
// Sprint Visual: botão + popover (presets + Calendar + inputs).
// Sprint Frontend (15/06/2026): pending state + rodapé Aplicar/Limpar
// (USWDS: NÃO auto-submeter na seleção). Clique no Calendar, em preset ou
// nos inputs apenas mexe no pendingRange interno; só APLICAR escreve na
// URL/dispara filtro. Fechar fora ou Esc descarta o pending.

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

const MONTHS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function formatRange(value: DateRangeInput): string {
  if (!value.inicio && !value.fim) return 'Selecionar período'
  const fmt = (iso: string) => {
    if (!iso) return ''
    const d = new Date(iso + 'T12:00:00Z')
    return `${d.getUTCDate()} ${MONTHS_PT[d.getUTCMonth()]}`
  }
  if (value.inicio && value.fim) {
    if (value.inicio === value.fim) return fmt(value.inicio)
    return `${fmt(value.inicio)} – ${fmt(value.fim)}`
  }
  return fmt(value.inicio || value.fim)
}

// "3 jun – 9 jun · 7 dias" (inclusivo). Vazio/parcial: "Selecione um período".
function formatPendingSummary(pending: DateRangeInput): string {
  if (!pending.inicio || !pending.fim) return 'Selecione um período'
  const fmt = (iso: string) => {
    const d = new Date(iso + 'T12:00:00Z')
    return `${d.getUTCDate()} ${MONTHS_PT[d.getUTCMonth()]}`
  }
  const a = new Date(pending.inicio + 'T12:00:00Z').getTime()
  const b = new Date(pending.fim + 'T12:00:00Z').getTime()
  const days = Math.round((b - a) / 86400000) + 1
  const head = pending.inicio === pending.fim ? fmt(pending.inicio) : `${fmt(pending.inicio)} – ${fmt(pending.fim)}`
  return `${head} · ${days} dia${days === 1 ? '' : 's'}`
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
  // PENDING STATE LOCAL — só comita no APLICAR. Sync com `value` quando abre.
  const [pending, setPending] = React.useState<DateRangeInput>(value)

  // Ao ABRIR o popover, ressincroniza pending com o range JÁ comitado.
  // Ao FECHAR (sem aplicar), o efeito não dispara — descarta o pending
  // automaticamente porque o trigger sempre lê `value`, não `pending`.
  React.useEffect(() => {
    if (open) setPending(value)
  }, [open, value])

  const selectedPreset = React.useMemo(() => detectPreset(pending), [pending])
  const hasCommittedValue = !!(value.inicio || value.fim)

  const dpRange: DateRange | undefined = React.useMemo(() => {
    if (!pending.inicio && !pending.fim) return undefined
    return {
      from: isoToDate(pending.inicio) ?? undefined,
      to: isoToDate(pending.fim) ?? undefined,
    }
  }, [pending.inicio, pending.fim])

  // ====== Handlers — TODOS apenas mexem no `pending`. NÃO comitam. ======

  function handlePreset(id: VisualPresetId) {
    if (id === 'custom') {
      // "Personalizado": só esvazia o calendário pra usuário escolher manualmente.
      // NÃO comita.
      setPending({ inicio: '', fim: '' })
      return
    }
    if (id === 'todos') {
      setPending({ inicio: '', fim: '' })
      return
    }
    // Preset pré-preenche o pending, não comita, não fecha.
    setPending(resolvePreset(id))
  }

  function handleCalendarSelect(range: DateRange | undefined) {
    // ⚠️ AQUI ESTAVA O BUG ANTIGO (auto-submit). Agora SÓ mexe no pending.
    if (!range) {
      setPending({ inicio: '', fim: '' })
      return
    }
    setPending({ inicio: dateToIso(range.from), fim: dateToIso(range.to) })
  }

  function handleInput(field: 'inicio' | 'fim', v: string) {
    const next = { ...pending, [field]: v }
    if (next.inicio && next.fim && next.inicio > next.fim) {
      // ordem garantida — colapsa pro mesmo dia
      setPending({ inicio: v, fim: v })
      return
    }
    setPending(next)
  }

  // APLICAR: enabled quando completo OU totalmente vazio (=limpa).
  const isComplete = !!(pending.inicio && pending.fim)
  const isEmpty = !pending.inicio && !pending.fim
  const canApply = isComplete || isEmpty

  function handleApply() {
    if (!canApply) return
    onChange(pending) // ÚNICO ponto de commit/URL write/dispara filtro
    setOpen(false)
  }

  function handleClear() {
    // Zera APENAS o pending. NÃO toca no filtro comitado, NÃO fecha.
    setPending({ inicio: '', fim: '' })
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
              // Trigger reflete o VALOR COMITADO (não o pending).
              hasCommittedValue && 'bg-primary/10 border-primary/40 text-primary hover:bg-primary/15 hover:text-primary',
            )}
          >
            <CalendarIcon className="size-3.5" />
            <span>{formatRange(value)}</span>
            <ChevronDown className="size-3.5 opacity-60 ml-1" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex">
            {/* Esquerda: presets */}
            <div className="w-[180px] border-r p-2 space-y-0.5">
              {PRESETS.map((p) => {
                const active = selectedPreset === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handlePreset(p.id)}
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
            {/* Direita: inputs De/Até + Calendar */}
            <div className="p-3 space-y-3">
              <div className="flex items-end gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">De</Label>
                  <Input
                    type="date"
                    className="h-8 w-32 text-sm"
                    value={pending.inicio}
                    onChange={(e) => handleInput('inicio', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Até</Label>
                  <Input
                    type="date"
                    className="h-8 w-32 text-sm"
                    value={pending.fim}
                    onChange={(e) => handleInput('fim', e.target.value)}
                  />
                </div>
              </div>
              <Calendar
                mode="range"
                numberOfMonths={1}
                selected={dpRange}
                onSelect={handleCalendarSelect}
                defaultMonth={isoToDate(pending.inicio) ?? new Date()}
              />
            </div>
          </div>
          {/* Rodapé com Aplicar/Limpar (padrão USWDS/GA/Semrush) */}
          <div className="flex items-center justify-between gap-2 border-t bg-muted/30 px-3 py-2 text-xs">
            <span className={cn(
              'text-muted-foreground',
              isComplete && 'text-foreground font-medium',
            )}>
              {formatPendingSummary(pending)}
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="h-7 text-xs"
              >
                Limpar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleApply}
                disabled={!canApply}
                className="h-7 text-xs"
              >
                Aplicar
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
