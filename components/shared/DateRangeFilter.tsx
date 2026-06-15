// Componente compartilhado de filtro de data — Sprint Filtro de Data Parte A.
// Presets (Hoje, 7d, 30d, Mês atual, Mês passado, Custom) + 2 inputs de/até
// quando o user escolhe Custom.
//
// Stateless: valores vêm das props (inicio/fim) — o caller costuma usar
// useDateRangeFilter que sincroniza com URL.

'use client'

import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  rangeForPreset,
  type DateRange,
  type PresetId,
} from '@/lib/hooks/use-date-range-filter'

type SelectValueId = PresetId | 'todos' | 'custom'

interface Props {
  value: DateRange
  onChange: (range: DateRange) => void
  /** Label semântica do campo filtrado. Usado pra rótulos: 'Período', 'Vencimento'. */
  label?: string
  /** Nome semântico da coluna do banco (info pro caller; não muda comportamento). */
  dateField?: 'date' | 'dueDate' | 'paymentDate'
  /** Default selecionado quando nem inicio nem fim estão preenchidos. */
  defaultPreset?: SelectValueId
}

const PRESET_LABELS: Record<SelectValueId, string> = {
  todos: 'Todos',
  hoje: 'Hoje',
  'ultimos-7d': 'Últimos 7 dias',
  'ultimos-30d': 'Últimos 30 dias',
  'mes-atual': 'Mês atual',
  'mes-passado': 'Mês passado',
  custom: 'Período customizado',
}

function detectPreset(range: DateRange): SelectValueId {
  if (!range.inicio && !range.fim) return 'todos'
  const presets: PresetId[] = [
    'hoje',
    'ultimos-7d',
    'ultimos-30d',
    'mes-atual',
    'mes-passado',
  ]
  for (const p of presets) {
    const r = rangeForPreset(p)
    if (r.inicio === range.inicio && r.fim === range.fim) return p
  }
  return 'custom'
}

export function DateRangeFilter({
  value,
  onChange,
  label = 'Período',
  defaultPreset,
}: Props) {
  const [selected, setSelected] = useState<SelectValueId>(() =>
    detectPreset(value) === 'todos' && defaultPreset
      ? defaultPreset
      : detectPreset(value),
  )

  // Mantém o select sincronizado quando value muda externamente (URL/back).
  useEffect(() => {
    setSelected(detectPreset(value))
  }, [value])

  function handlePreset(id: SelectValueId) {
    setSelected(id)
    if (id === 'todos') {
      onChange({ inicio: '', fim: '' })
      return
    }
    if (id === 'custom') {
      // Não muda value imediatamente; user vai preencher inputs
      return
    }
    onChange(rangeForPreset(id as PresetId))
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <Select value={selected} onValueChange={(v) => handlePreset(v as SelectValueId)}>
          <SelectTrigger className="h-8 w-44 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">{PRESET_LABELS['todos']}</SelectItem>
            <SelectItem value="hoje">{PRESET_LABELS['hoje']}</SelectItem>
            <SelectItem value="ultimos-7d">{PRESET_LABELS['ultimos-7d']}</SelectItem>
            <SelectItem value="ultimos-30d">{PRESET_LABELS['ultimos-30d']}</SelectItem>
            <SelectItem value="mes-atual">{PRESET_LABELS['mes-atual']}</SelectItem>
            <SelectItem value="mes-passado">{PRESET_LABELS['mes-passado']}</SelectItem>
            <SelectItem value="custom">{PRESET_LABELS['custom']}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {selected === 'custom' && (
        <>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">De</Label>
            <Input
              type="date"
              className="h-8 w-36 text-sm"
              value={value.inicio}
              onChange={(e) => onChange({ inicio: e.target.value, fim: value.fim })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Até</Label>
            <Input
              type="date"
              className="h-8 w-36 text-sm"
              value={value.fim}
              onChange={(e) => onChange({ inicio: value.inicio, fim: e.target.value })}
            />
          </div>
        </>
      )}
    </div>
  )
}
