'use client'

// Sprint 5.0.3.0c (c3) — Combobox de categoria inline pra edit.
//
// Input com busca + dropdown absoluto com categorias filtradas.
// Última opção: "+ Criar 'TextoDigitado'" se não bate nada.
//
// Endpoint /inline aceita sentinel "__create__:Nome" pra criar nova.

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { Plus, Loader2, AlertCircle, Search } from 'lucide-react'

export interface CategoryOption {
  id: string
  name: string
}

interface Props {
  /** Categoria atual (id) — null se não tem. */
  currentId: string | null
  /** Nome atual da categoria (display). */
  currentName: string | null
  isEditing: boolean
  isSaving?: boolean
  hasError?: boolean
  /** Lista de categorias disponíveis (já carregadas pelo pai). */
  options: CategoryOption[]
  onStartEdit: () => void
  /** Disparado ao selecionar — id de categoria existente OU sentinel "__create__:Nome" OU null. */
  onSave: (newValueOrSentinel: string | null) => void
  onCancel: () => void
}

const MAX_VISIBLE = 8

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

export function CategoryComboboxCell({
  currentId,
  currentName,
  isEditing,
  isSaving,
  hasError,
  options,
  onStartEdit,
  onSave,
  onCancel,
}: Props) {
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing) {
      setQuery('')
      setHighlight(0)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [isEditing])

  const filtered = useMemo(() => {
    const q = normalize(query)
    if (!q) return options.slice(0, MAX_VISIBLE)
    return options
      .filter((o) => normalize(o.name).includes(q))
      .slice(0, MAX_VISIBLE)
  }, [query, options])

  // Pode criar se: query não vazia + nenhuma categoria existente bate EXATAMENTE
  const canCreate = useMemo(() => {
    const q = query.trim()
    if (!q) return false
    return !options.some((o) => normalize(o.name) === normalize(q))
  }, [query, options])

  const totalItems = filtered.length + (canCreate ? 1 : 0)

  const handleSelect = useCallback(
    (index: number) => {
      if (index < filtered.length) {
        onSave(filtered[index].id)
      } else if (canCreate) {
        onSave(`__create__:${query.trim()}`)
      }
    },
    [filtered, canCreate, query, onSave],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHighlight((h) => Math.min(h + 1, totalItems - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlight((h) => Math.max(h - 1, 0))
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        if (totalItems > 0) {
          handleSelect(highlight)
        } else {
          onCancel()
        }
      }
    },
    [totalItems, highlight, handleSelect, onCancel],
  )

  // Display mode
  if (!isEditing) {
    return (
      <span
        role="button"
        tabIndex={0}
        aria-label="Editar categoria"
        onDoubleClick={(e) => {
          e.stopPropagation()
          onStartEdit()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === 'F2') {
            e.preventDefault()
            e.stopPropagation()
            onStartEdit()
          }
        }}
        className={`inline-flex items-center gap-1 px-1 -mx-1 rounded cursor-text hover:bg-muted/40 ${
          hasError ? 'text-red-600' : ''
        }`}
        data-testid="combobox-cell-display"
      >
        {hasError && <AlertCircle className="h-3 w-3" />}
        <span className={isSaving ? 'opacity-60' : ''}>
          {currentName ?? <span className="text-muted-foreground">—</span>}
        </span>
        {isSaving && <Loader2 className="h-3 w-3 animate-spin" />}
      </span>
    )
  }

  // Edit mode
  return (
    <div
      className="relative"
      onClick={(e) => e.stopPropagation()}
      data-testid="combobox-cell-edit"
    >
      <div className="flex items-center gap-1 bg-background border border-primary rounded px-1.5 py-0.5 ring-2 ring-primary/30">
        <Search className="h-3 w-3 text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setHighlight(0)
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => setTimeout(onCancel, 150)} // delay pra click numa option
          placeholder={currentName ?? 'Buscar categoria...'}
          className="w-full bg-transparent outline-none text-sm"
          data-testid="combobox-cell-input"
        />
      </div>
      <div
        className="absolute left-0 top-full mt-1 z-50 w-64 max-h-64 overflow-auto bg-popover border rounded-md shadow-lg py-1"
        role="listbox"
      >
        {filtered.length === 0 && !canCreate && (
          <div className="px-3 py-2 text-xs text-muted-foreground">
            Nenhuma categoria encontrada
          </div>
        )}
        {filtered.map((opt, idx) => (
          <button
            key={opt.id}
            type="button"
            role="option"
            aria-selected={idx === highlight}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleSelect(idx)}
            onMouseEnter={() => setHighlight(idx)}
            className={`w-full text-left px-3 py-1.5 text-sm hover:bg-muted/50 ${
              idx === highlight ? 'bg-muted/50' : ''
            } ${opt.id === currentId ? 'font-medium' : ''}`}
            data-testid={`combobox-option-${opt.id}`}
          >
            {opt.name}
          </button>
        ))}
        {canCreate && (
          <button
            type="button"
            role="option"
            aria-selected={highlight === filtered.length}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleSelect(filtered.length)}
            onMouseEnter={() => setHighlight(filtered.length)}
            className={`w-full text-left px-3 py-1.5 text-sm border-t hover:bg-muted/50 flex items-center gap-1.5 ${
              highlight === filtered.length ? 'bg-muted/50' : ''
            }`}
            data-testid="combobox-option-create"
          >
            <Plus className="h-3 w-3 text-emerald-600" />
            <span>
              Criar{' '}
              <strong className="text-foreground">
                &quot;{query.trim()}&quot;
              </strong>
            </span>
          </button>
        )}
      </div>
    </div>
  )
}
