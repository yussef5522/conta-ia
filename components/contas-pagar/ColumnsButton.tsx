'use client'

// Sprint 5.0.3.0c (c2) — DropdownMenu de Show/Hide de colunas.
//
// Bloqueia toggle de colunas marcadas como `alwaysVisible` (Status/Valor/Ações).
// Persistência localStorage via useTablePreferences (callsite).

import { Columns3, ChevronDown, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export interface ColumnDef {
  id: string
  name: string
  /** Se true, NÃO pode ser escondida (Status/Valor/Ações). */
  alwaysVisible?: boolean
}

interface Props {
  columns: ColumnDef[]
  /** IDs das colunas atualmente escondidas. */
  hidden: string[]
  onToggle: (columnId: string) => void
}

export function ColumnsButton({ columns, hidden, onToggle }: Props) {
  const hiddenSet = new Set(hidden)
  const visibleCount = columns.length - hidden.length

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          aria-label="Configurar colunas visíveis"
          data-testid="columns-button"
        >
          <Columns3 className="h-3.5 w-3.5 mr-1.5" />
          Colunas
          <span className="ml-1 text-[10px] text-muted-foreground tabular-nums">
            ({visibleCount}/{columns.length})
          </span>
          <ChevronDown className="ml-1 h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs">
          Colunas visíveis
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map((col) => {
          const isVisible = !hiddenSet.has(col.id)
          const isLocked = col.alwaysVisible === true
          return (
            <DropdownMenuCheckboxItem
              key={col.id}
              checked={isVisible}
              disabled={isLocked}
              onSelect={(e) => {
                e.preventDefault() // mantém menu aberto pra múltiplos toggles
                if (!isLocked) onToggle(col.id)
              }}
              data-testid={`column-toggle-${col.id}`}
            >
              <span className="flex-1">{col.name}</span>
              {isLocked && (
                <Lock
                  className="h-3 w-3 ml-1 text-muted-foreground/60"
                  aria-label="Sempre visível"
                />
              )}
            </DropdownMenuCheckboxItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
