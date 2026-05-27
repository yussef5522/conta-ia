'use client'

// Sprint 5.0.3.0b — Tabs das 4 saved views.
//
// Posição: entre o header da página e os stats cards.
// Mobile: overflow-x-auto pra scroll horizontal (chip não quebra linha).
// View "Custom" = nenhuma chip ativa (user mexeu manualmente nos filtros).

import { SAVED_VIEWS, type SavedViewId } from '@/lib/contas-pagar/saved-views'

interface Props {
  activeViewId: SavedViewId | null // null = "Custom"
  onSelect: (id: SavedViewId) => void
}

export function SavedViewTabs({ activeViewId, onSelect }: Props) {
  return (
    <div
      className="border-b border-border overflow-x-auto"
      role="tablist"
      aria-label="Visualizações salvas"
      data-testid="saved-view-tabs"
    >
      <div className="flex items-center gap-1 px-1 min-w-max">
        {SAVED_VIEWS.map((view) => {
          const isActive = view.id === activeViewId
          return (
            <button
              key={view.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls="contas-pagar-table"
              onClick={() => onSelect(view.id)}
              className={`
                relative px-3 py-2 text-sm font-medium whitespace-nowrap
                transition-colors duration-150
                ${
                  isActive
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }
                rounded-t-md
              `}
              data-testid={`saved-view-tab-${view.id}`}
              data-active={isActive ? 'true' : 'false'}
            >
              {view.name}
              {isActive && (
                <span
                  className="absolute inset-x-0 -bottom-px h-0.5 bg-primary"
                  aria-hidden="true"
                />
              )}
            </button>
          )
        })}
        {activeViewId === null && (
          <span
            className="ml-2 px-2 py-0.5 text-[10px] uppercase tracking-wide rounded bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300"
            data-testid="saved-view-custom-indicator"
          >
            Filtro custom
          </span>
        )}
      </div>
    </div>
  )
}
