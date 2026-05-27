'use client'

// Sprint 5.0.3.0b — Tabs das 4 saved views.
// Sprint 5.0.3.0c (c5) — Custom views CRUD: tabs custom + menu ⋯ + "+ Nova".
//
// Posição: entre o header da página e os stats cards.
// Mobile: overflow-x-auto pra scroll horizontal (chip não quebra linha).
//
// View "Custom" indicator = nenhuma chip ativa (user mexeu manualmente nos filtros).

import { Plus, MoreHorizontal, Pencil, Copy, Trash2 } from 'lucide-react'
import { SAVED_VIEWS, type SavedViewId } from '@/lib/contas-pagar/saved-views'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { CustomSavedView } from '@/lib/contas-pagar/use-saved-views'

interface Props {
  activeViewId: SavedViewId | null
  /** ID da custom view ativa (cuid), independente de activeViewId (system). */
  activeCustomId: string | null
  customViews: CustomSavedView[]
  onSelectSystem: (id: SavedViewId) => void
  onSelectCustom: (view: CustomSavedView) => void
  onNew: () => void
  onRename: (view: CustomSavedView) => void
  onDuplicate: (id: string) => void
  onDelete: (view: CustomSavedView) => void
}

export function SavedViewTabs({
  activeViewId,
  activeCustomId,
  customViews,
  onSelectSystem,
  onSelectCustom,
  onNew,
  onRename,
  onDuplicate,
  onDelete,
}: Props) {
  const isCustomMode = activeCustomId !== null
  const isCustomFilter =
    activeViewId === null && activeCustomId === null

  return (
    <div
      className="border-b border-border overflow-x-auto"
      role="tablist"
      aria-label="Visualizações salvas"
      data-testid="saved-view-tabs"
    >
      <div className="flex items-center gap-1 px-1 min-w-max">
        {/* System views (4 fixas) */}
        {SAVED_VIEWS.map((view) => {
          const isActive = !isCustomMode && view.id === activeViewId
          return (
            <button
              key={view.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls="contas-pagar-table"
              onClick={() => onSelectSystem(view.id)}
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

        {/* Separador visual antes das custom views */}
        {customViews.length > 0 && (
          <div
            className="w-px h-5 bg-border mx-1 shrink-0"
            aria-hidden="true"
          />
        )}

        {/* Custom views do usuário */}
        {customViews.map((view) => {
          const isActive = activeCustomId === view.id
          return (
            <div
              key={view.id}
              className="flex items-center relative"
              data-testid={`saved-view-custom-${view.id}`}
            >
              <button
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onSelectCustom(view)}
                className={`
                  relative pl-3 pr-1 py-2 text-sm font-medium whitespace-nowrap
                  transition-colors duration-150 flex items-center gap-1.5
                  ${
                    isActive
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }
                  rounded-t-md
                `}
              >
                {view.icon && <span className="text-base">{view.icon}</span>}
                {view.name}
                {isActive && (
                  <span
                    className="absolute inset-x-0 -bottom-px h-0.5 bg-primary"
                    aria-hidden="true"
                  />
                )}
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={`Menu da view ${view.name}`}
                    className="px-1 py-2 text-muted-foreground hover:text-foreground hover:bg-muted/30 rounded"
                    data-testid={`saved-view-menu-${view.id}`}
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  <DropdownMenuItem onSelect={() => onRename(view)}>
                    <Pencil className="mr-2 h-3.5 w-3.5" />
                    Renomear
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => onDuplicate(view.id)}>
                    <Copy className="mr-2 h-3.5 w-3.5" />
                    Duplicar
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => onDelete(view)}
                    className="text-red-600 focus:text-red-700 focus:bg-red-50 dark:focus:bg-red-950/30"
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        })}

        {/* + Nova view */}
        <button
          type="button"
          onClick={onNew}
          className="px-2 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded inline-flex items-center gap-1 whitespace-nowrap"
          aria-label="Criar nova view customizada"
          data-testid="saved-view-new"
        >
          <Plus className="h-3.5 w-3.5" />
          Nova
        </button>

        {isCustomFilter && (
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
