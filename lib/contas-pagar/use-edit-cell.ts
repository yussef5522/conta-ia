'use client'

// Sprint 5.0.3.0c (c3) — Hook que gerencia estado de Edit Inline.
//
// Modelo de estado:
//   - editing.rowId + editing.field identificam UMA célula em edição global
//   - state.status: idle (não editando) | editing | saving | error
//
// Transições:
//   - startEdit(rowId, field) → status=editing
//   - save() → optimistic update + PATCH async + (success: idle | error: error com revert)
//   - cancel() → status=idle (sem mudar nada)

import { useState, useCallback, useRef } from 'react'

export type EditableField =
  | 'description'
  | 'amount'
  | 'dueDate'
  | 'categoryId'

export type EditStatus = 'idle' | 'editing' | 'saving' | 'error'

export interface EditingCell {
  rowId: string
  field: EditableField
}

interface UseEditCellArgs {
  empresaId: string
  /** Optimistic update — atualiza o state da row localmente ANTES do servidor. */
  onOptimisticUpdate: (
    rowId: string,
    field: EditableField,
    value: unknown,
  ) => void
  /** Revert em caso de erro — restaura valor anterior na row. */
  onRevert: (rowId: string, field: EditableField, prevValue: unknown) => void
  /** Toast de erro pro user. */
  onError: (message: string) => void
}

interface UseEditCellResult {
  editing: EditingCell | null
  status: EditStatus
  isEditing: (rowId: string, field: EditableField) => boolean
  startEdit: (rowId: string, field: EditableField) => void
  cancel: () => void
  save: (
    rowId: string,
    field: EditableField,
    newValue: unknown,
    prevValue: unknown,
  ) => Promise<boolean>
}

export function useEditCell(args: UseEditCellArgs): UseEditCellResult {
  const [editing, setEditing] = useState<EditingCell | null>(null)
  const [status, setStatus] = useState<EditStatus>('idle')

  // Ref pra evitar race condition: se user pressiona Esc enquanto saving,
  // ignoramos o resultado do fetch (que vem depois).
  const abortRef = useRef<AbortController | null>(null)

  const isEditing = useCallback(
    (rowId: string, field: EditableField): boolean =>
      editing?.rowId === rowId && editing.field === field,
    [editing],
  )

  const startEdit = useCallback(
    (rowId: string, field: EditableField) => {
      setEditing({ rowId, field })
      setStatus('editing')
    },
    [],
  )

  const cancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    setEditing(null)
    setStatus('idle')
  }, [])

  const save = useCallback(
    async (
      rowId: string,
      field: EditableField,
      newValue: unknown,
      prevValue: unknown,
    ): Promise<boolean> => {
      setStatus('saving')

      // Optimistic — UI imediata
      args.onOptimisticUpdate(rowId, field, newValue)

      // Cancela request anterior pendente, se houver
      if (abortRef.current) abortRef.current.abort()
      const controller = new AbortController()
      abortRef.current = controller

      try {
        const res = await fetch(
          `/api/empresas/${args.empresaId}/contas-pagar/${rowId}/inline`,
          {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ field, value: newValue }),
            signal: controller.signal,
          },
        )

        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          const message = data.erro ?? `HTTP ${res.status}`
          args.onRevert(rowId, field, prevValue)
          args.onError(message)
          setStatus('error')
          return false
        }

        setEditing(null)
        setStatus('idle')
        return true
      } catch (err) {
        // AbortError = cancelado pelo user (Esc) — não conta como erro
        if (err instanceof Error && err.name === 'AbortError') {
          args.onRevert(rowId, field, prevValue)
          return false
        }
        args.onRevert(rowId, field, prevValue)
        args.onError('Erro de rede. Tente novamente.')
        setStatus('error')
        return false
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null
        }
      }
    },
    [args],
  )

  return { editing, status, isEditing, startEdit, cancel, save }
}
