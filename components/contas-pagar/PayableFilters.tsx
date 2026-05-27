'use client'

// Sprint 5.0.3.0a — Filtros da /contas-a-pagar (versão CORE).
//
// Esta sub-sprint inclui filtros essenciais:
//   - Busca textual (debounce 300ms no callsite)
//   - Período: De/Até via input[type=date] HTML
//   - Status: select (TODOS/PENDING/RECONCILED/IGNORED)
//   - Toggle "Só vencidas"
//   - Botão "Limpar filtros" (aparece quando há filtros ativos)
//
// 5.0.3.0b adiciona: dataField select, multi-select supplier/categoria, valor range.
// 5.0.3.0c adiciona: forma pagamento, banco, NFe, recorrente.

import { Search, X, CalendarRange } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export interface PayableFilterState {
  q: string
  dataDe: string // YYYY-MM-DD
  dataAte: string
  status: 'TODOS' | 'PENDING' | 'RECONCILED' | 'IGNORED'
  vencidasOnly: boolean
}

export const EMPTY_FILTERS: PayableFilterState = {
  q: '',
  dataDe: '',
  dataAte: '',
  status: 'PENDING',
  vencidasOnly: false,
}

export function isFilterActive(f: PayableFilterState): boolean {
  return (
    !!f.q.trim() ||
    !!f.dataDe ||
    !!f.dataAte ||
    f.status !== 'PENDING' ||
    f.vencidasOnly
  )
}

interface Props {
  value: PayableFilterState
  onChange: (next: PayableFilterState) => void
  onClear: () => void
  total: number
}

export function PayableFilters({ value, onChange, onClear, total }: Props) {
  const active = isFilterActive(value)

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="filters-bar">
      {/* Busca */}
      <div className="relative flex-1 min-w-[200px] max-w-md">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Buscar fornecedor, descrição, nota..."
          value={value.q}
          onChange={(e) => onChange({ ...value, q: e.target.value })}
          className="pl-7 h-9 text-sm"
          data-testid="filter-q"
          aria-label="Busca textual"
        />
      </div>

      {/* Período */}
      <div className="flex items-center gap-1.5 bg-muted/30 rounded-md px-2 h-9 text-xs">
        <CalendarRange className="h-3.5 w-3.5 text-muted-foreground" />
        <Input
          type="date"
          value={value.dataDe}
          onChange={(e) => onChange({ ...value, dataDe: e.target.value })}
          className="h-7 w-32 border-0 bg-transparent p-0 text-xs"
          aria-label="Data de início"
          data-testid="filter-dataDe"
        />
        <span className="text-muted-foreground">→</span>
        <Input
          type="date"
          value={value.dataAte}
          onChange={(e) => onChange({ ...value, dataAte: e.target.value })}
          className="h-7 w-32 border-0 bg-transparent p-0 text-xs"
          aria-label="Data fim"
          data-testid="filter-dataAte"
        />
      </div>

      {/* Status */}
      <Select
        value={value.status}
        onValueChange={(v) =>
          onChange({ ...value, status: v as PayableFilterState['status'] })
        }
      >
        <SelectTrigger
          className="w-auto min-w-[140px] h-9 text-sm"
          data-testid="filter-status"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="PENDING">Pendentes</SelectItem>
          <SelectItem value="RECONCILED">Conciliadas</SelectItem>
          <SelectItem value="IGNORED">Ignoradas</SelectItem>
          <SelectItem value="TODOS">Todos status</SelectItem>
        </SelectContent>
      </Select>

      {/* Vencidas only */}
      <label className="flex items-center gap-1.5 text-sm text-muted-foreground select-none px-2">
        <Input
          type="checkbox"
          className="w-3.5 h-3.5"
          checked={value.vencidasOnly}
          onChange={(e) =>
            onChange({ ...value, vencidasOnly: e.target.checked })
          }
          aria-label="Só vencidas"
          data-testid="filter-vencidasOnly"
        />
        Só vencidas
      </label>

      <div className="flex-1" />

      {/* Total + limpar */}
      <span className="text-xs text-muted-foreground tabular-nums">
        {total} {total === 1 ? 'conta' : 'contas'}
      </span>

      {active && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="h-8"
          data-testid="filters-clear"
        >
          <X className="h-3.5 w-3.5 mr-1" />
          Limpar
        </Button>
      )}
    </div>
  )
}
