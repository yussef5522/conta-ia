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
        px-4 py-2.5 flex items-center gap-3
        animate-in slide-in-from-top-2 duration-200
      "
      data-testid="bulk-actions-bar"
    >
      <span className="text-sm font-medium tabular-nums">
        {selectedCount} {selectedCount === 1 ? 'selecionada' : 'selecionadas'}
      </span>

      <div className="flex-1" />

      <Button
        size="sm"
        variant="default"
        onClick={onMarkPaid}
        data-testid="bulk-mark-paid"
      >
        <Check className="h-3.5 w-3.5 mr-1.5" />
        Marcar como pagas
      </Button>

      <Button
        size="sm"
        variant="destructive"
        onClick={onDelete}
        data-testid="bulk-delete"
      >
        <Trash2 className="h-3.5 w-3.5 mr-1.5" />
        Excluir
      </Button>

      <Button
        size="sm"
        variant="ghost"
        onClick={onClear}
        aria-label="Cancelar seleção"
        data-testid="bulk-clear"
      >
        <X className="h-3.5 w-3.5 mr-1" />
        Cancelar
      </Button>
    </div>
  )
}
