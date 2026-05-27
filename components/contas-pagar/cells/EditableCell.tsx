'use client'

// Sprint 5.0.3.0c (c3) — Cell editor inline polimórfico (text/number/date).
//
// Categoria tem componente próprio (CategoryComboboxCell.tsx) por complexidade.
//
// Comportamento:
//   - Renderiza valor formatado quando NÃO está em edit (props.isEditing=false)
//   - Renderiza input nativo focado quando isEditing=true
//   - Enter → onSave(parsedValue)
//   - Esc   → onCancel
//   - Tab   → mesma logic de Enter (parent decide próxima célula)
//   - Click fora → onSave OR onCancel (configurável via blurAction)
//   - Double-click no display ativa edit (parent dispara startEdit)

import { useEffect, useRef, useState, useCallback } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import {
  parseBRAmount,
  formatBRAmount,
  isValidBRAmount,
} from '@/lib/contas-pagar/format-amount-br'

export type EditableCellType = 'text' | 'number' | 'date'

interface Props {
  type: EditableCellType
  /** Valor atual (display) — string pra todos os tipos. */
  value: string
  /** True quando cell está sendo editada agora. */
  isEditing: boolean
  /** True durante save (mostra spinner). */
  isSaving?: boolean
  /** True se último save deu erro (mostra ícone). */
  hasError?: boolean
  /** Disparado pra entrar em edit (double-click no display). */
  onStartEdit: () => void
  /** Disparado ao Enter/Tab — recebe valor parseado/raw conforme type. */
  onSave: (newValue: string | number | Date) => void
  /** Disparado ao Esc — caller só sai do edit mode. */
  onCancel: () => void
  /** Label PT-BR pro aria. */
  aria?: string
}

function formatDisplay(type: EditableCellType, value: string): string {
  if (type === 'number') {
    const n = parseBRAmount(value)
    if (Number.isFinite(n)) return formatBRAmount(n)
  }
  if (type === 'date' && value) {
    // ISO ou DD/MM/YYYY → exibe DD/MM/YYYY
    const d = new Date(value)
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
    }
  }
  return value || '—'
}

export function EditableCell({
  type,
  value,
  isEditing,
  isSaving,
  hasError,
  onStartEdit,
  onSave,
  onCancel,
  aria,
}: Props) {
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  // Hidrata draft quando entra em edit (não toda render — só quando isEditing flip)
  useEffect(() => {
    if (isEditing) {
      // Pra number, edita a string crua simplificada (sem ponto de milhar)
      if (type === 'number') {
        const n = parseBRAmount(value)
        setDraft(Number.isFinite(n) ? formatBRAmount(n) : value)
      } else if (type === 'date' && value) {
        // Converte ISO/Date → YYYY-MM-DD pro input
        const d = new Date(value)
        setDraft(
          Number.isNaN(d.getTime())
            ? ''
            : d.toISOString().slice(0, 10),
        )
      } else {
        setDraft(value)
      }
      // Foca + seleciona
      setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        commit()
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft, type, onSave, onCancel],
  )

  const commit = useCallback(() => {
    if (type === 'number') {
      if (!isValidBRAmount(draft)) {
        onCancel() // valor inválido → não salva, sai do edit
        return
      }
      onSave(parseBRAmount(draft))
      return
    }
    if (type === 'date') {
      if (!draft) {
        onCancel()
        return
      }
      const d = new Date(draft + 'T00:00:00.000Z')
      if (Number.isNaN(d.getTime())) {
        onCancel()
        return
      }
      onSave(d)
      return
    }
    // text
    const trimmed = draft.trim()
    if (!trimmed) {
      onCancel()
      return
    }
    onSave(trimmed)
  }, [draft, type, onSave, onCancel])

  // Display mode
  if (!isEditing) {
    return (
      <span
        role="button"
        tabIndex={0}
        aria-label={aria ?? `Editar célula (${type})`}
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
        data-testid="editable-cell-display"
      >
        {hasError && <AlertCircle className="h-3 w-3" />}
        <span className={isSaving ? 'opacity-60' : ''}>
          {formatDisplay(type, value)}
        </span>
        {isSaving && <Loader2 className="h-3 w-3 animate-spin" />}
      </span>
    )
  }

  // Edit mode
  return (
    <input
      ref={inputRef}
      type={type === 'date' ? 'date' : type === 'number' ? 'text' : 'text'}
      inputMode={type === 'number' ? 'decimal' : undefined}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={commit}
      onClick={(e) => e.stopPropagation()}
      className="w-full max-w-[200px] bg-background border border-primary rounded px-1.5 py-0.5 text-sm outline-none ring-2 ring-primary/30"
      data-testid="editable-cell-input"
      aria-label={aria ?? `Editar ${type}`}
    />
  )
}
