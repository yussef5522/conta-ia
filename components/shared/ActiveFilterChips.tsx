// Sprint Visual (15/06/2026) — Chips de filtro ativo (substitui banners).
// Pills arredondadas com label + "x" pra remover individual. Link "Limpar tudo".
// Contagem integrada via prop count (ex: "172 lançamentos").

'use client'

import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ActiveChip {
  /** Identificador estável pro key (ex: 'periodo', 'tipo', 'busca'). */
  id: string
  /** Texto visível na pill. */
  label: string
  /** Callback ao clicar no "x". */
  onRemove: () => void
}

interface Props {
  chips: ActiveChip[]
  /** Limpar todos os filtros de uma vez. */
  onClearAll?: () => void
  /** Contagem opcional ("172 lançamentos"). */
  count?: number
  /** Substantivo singular/plural pra contagem. */
  countLabel?: { one: string; other: string }
  /** Esconde o componente quando não há nada — caller também pode controlar. */
  hideWhenEmpty?: boolean
  className?: string
}

export function ActiveFilterChips({
  chips,
  onClearAll,
  count,
  countLabel = { one: 'lançamento', other: 'lançamentos' },
  hideWhenEmpty = true,
  className,
}: Props) {
  const hasAny = chips.length > 0
  if (hideWhenEmpty && !hasAny && count === undefined) return null

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5 text-xs', className)}>
      {chips.map((chip) => (
        <span
          key={chip.id}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full pl-2.5 pr-1 py-0.5',
            'bg-primary/10 text-primary',
            'ring-[0.5px] ring-primary/30',
          )}
        >
          <span className="font-medium">{chip.label}</span>
          <button
            type="button"
            onClick={chip.onRemove}
            aria-label={`Remover filtro ${chip.label}`}
            className="inline-flex items-center justify-center rounded-full size-4 hover:bg-primary/15 transition-colors"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      {hasAny && onClearAll && (
        <button
          type="button"
          onClick={onClearAll}
          className="text-muted-foreground hover:text-foreground underline underline-offset-2 ml-1"
        >
          Limpar tudo
        </button>
      )}
      {count !== undefined && (
        <span className={cn('text-muted-foreground', hasAny ? 'ml-2' : '')}>
          {count} {count === 1 ? countLabel.one : countLabel.other}
        </span>
      )}
    </div>
  )
}
