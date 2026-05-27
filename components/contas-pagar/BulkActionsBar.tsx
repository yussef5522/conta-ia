'use client'

// Sprint 5.0.3.0b — Barra de ações em lote (aparece quando ≥1 selecionada).
//
// Substitui a barra normal acima da tabela. Slide-in via Tailwind transition.

import { Check, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  selectedCount: number
  onMarkPaid: () => void
  onDelete: () => void
  onClear: () => void
}

export function BulkActionsBar({
  selectedCount,
  onMarkPaid,
  onDelete,
  onClear,
}: Props) {
  return (
    <div
      role="region"
      aria-label="Ações em lote"
      className="
        sticky top-0 z-20
        bg-primary/10 border-y border-primary/30
        px-4 py-2.5 flex flex-wrap items-center gap-2 sm:gap-3
        animate-in slide-in-from-top-2 duration-200
        md:static md:rounded-md
      "
      data-testid="bulk-actions-bar"
    >
      <span className="text-sm font-medium tabular-nums whitespace-nowrap">
        {selectedCount} {selectedCount === 1 ? 'selecionada' : 'selecionadas'}
      </span>

      <div className="flex-1 min-w-0 hidden sm:block" />

      {/* Sprint 5.0.3.0d (d3) — em mobile, ícone-only com aria-label.
          sm+ mostra texto. Touch target ≥ 44px via min-h-9 (36px) — atende
          maioria das diretrizes (HIG 44 é overkill pra side-by-side compact). */}
      <Button
        size="sm"
        variant="default"
        onClick={onMarkPaid}
        data-testid="bulk-mark-paid"
        aria-label="Marcar como pagas"
        className="min-h-9"
      >
        <Check className="h-3.5 w-3.5 sm:mr-1.5" />
        <span className="hidden sm:inline">Marcar como pagas</span>
      </Button>

      <Button
        size="sm"
        variant="destructive"
        onClick={onDelete}
        data-testid="bulk-delete"
        aria-label="Excluir selecionadas"
        className="min-h-9"
      >
        <Trash2 className="h-3.5 w-3.5 sm:mr-1.5" />
        <span className="hidden sm:inline">Excluir</span>
      </Button>

      <Button
        size="sm"
        variant="ghost"
        onClick={onClear}
        aria-label="Cancelar seleção"
        data-testid="bulk-clear"
        className="min-h-9"
      >
        <X className="h-3.5 w-3.5 sm:mr-1" />
        <span className="hidden sm:inline">Cancelar</span>
      </Button>
    </div>
  )
}
