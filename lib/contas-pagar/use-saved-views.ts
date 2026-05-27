'use client'

// Sprint 5.0.3.0c (c5) — Hook que gerencia CRUD de saved views customizadas.
//
// Fetch GET /api/saved-views?empresaId=X + métodos create/update/delete/duplicate/reorder.
// Otimização: optimistic UI ao criar/renomear/excluir (revert em erro via refetch).

import { useState, useEffect, useCallback } from 'react'

export interface CustomSavedView {
  id: string
  userId: string
  empresaId: string | null
  scope: string
  name: string
  icon: string | null
  filters: string // JSON
  sortBy: string | null
  sortDir: string | null
  columnOrder: string // JSON
  columnHidden: string // JSON
  density: string
  pinnedOrder: number
  createdAt: string
  updatedAt: string
}

interface UseSavedViewsArgs {
  empresaId: string
  scope?: string
  onError?: (msg: string) => void
}

interface CreateInput {
  name: string
  icon?: string | null
  filters: string
  density?: string
  columnOrder?: string
  columnHidden?: string
}

export function useSavedViews({
  empresaId,
  scope = 'payable',
  onError,
}: UseSavedViewsArgs) {
  const [views, setViews] = useState<CustomSavedView[]>([])
  const [loading, setLoading] = useState(false)

  const refetch = useCallback(async () => {
    if (!empresaId) {
      setViews([])
      return
    }
    setLoading(true)
    try {
      const res = await fetch(
        `/api/saved-views?empresaId=${empresaId}&scope=${scope}`,
        { credentials: 'include' },
      )
      if (res.ok) {
        const data = await res.json()
        setViews(data.views ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [empresaId, scope])

  useEffect(() => {
    void refetch()
  }, [refetch])

  const create = useCallback(
    async (input: CreateInput): Promise<CustomSavedView | null> => {
      const res = await fetch('/api/saved-views', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...input, empresaId, scope }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        onError?.(data.erro ?? 'Falha ao criar view')
        return null
      }
      const data = await res.json()
      await refetch()
      return data.view
    },
    [empresaId, scope, refetch, onError],
  )

  const update = useCallback(
    async (
      id: string,
      patch: { name?: string; icon?: string | null; filters?: string },
    ): Promise<boolean> => {
      const res = await fetch(`/api/saved-views/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        onError?.(data.erro ?? 'Falha ao atualizar view')
        return false
      }
      await refetch()
      return true
    },
    [refetch, onError],
  )

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      // Optimistic: remove da lista imediatamente
      setViews((prev) => prev.filter((v) => v.id !== id))
      const res = await fetch(`/api/saved-views/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        onError?.(data.erro ?? 'Falha ao excluir view')
        await refetch() // revert
        return false
      }
      return true
    },
    [refetch, onError],
  )

  const duplicate = useCallback(
    async (id: string): Promise<CustomSavedView | null> => {
      const res = await fetch(`/api/saved-views/${id}/duplicate`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        onError?.(data.erro ?? 'Falha ao duplicar view')
        return null
      }
      const data = await res.json()
      await refetch()
      return data.view
    },
    [refetch, onError],
  )

  const reorder = useCallback(
    async (newIds: string[]): Promise<boolean> => {
      // Optimistic: reordena imediatamente
      setViews((prev) => {
        const map = new Map(prev.map((v) => [v.id, v]))
        return newIds
          .map((id, idx) => {
            const v = map.get(id)
            return v ? { ...v, pinnedOrder: idx } : null
          })
          .filter((v): v is CustomSavedView => v !== null)
      })
      const res = await fetch('/api/saved-views/reorder', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: newIds, scope, empresaId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        onError?.(data.erro ?? 'Falha ao reordenar views')
        await refetch()
        return false
      }
      return true
    },
    [refetch, onError, scope, empresaId],
  )

  return { views, loading, refetch, create, update, remove, duplicate, reorder }
}
