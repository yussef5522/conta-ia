'use client'

// Sprint 4.0.3 — hook que faz polling de /api/dashboard/badges a cada 60s.
// Recebe empresaId opcional; só busca quando definido.

import { useEffect, useState } from 'react'

export interface SidebarBadges {
  contasAPagar: { vencidas: number; vencendoEm3Dias: number }
  conciliacao: { pendentes: number }
  // Sprint 5.0.2.h — Transações com status PENDING (precisam categorizar)
  transacoesPendentes?: number
}

const POLL_INTERVAL_MS = 60_000

export function useSidebarBadges(empresaId: string | null): SidebarBadges | null {
  const [badges, setBadges] = useState<SidebarBadges | null>(null)

  useEffect(() => {
    if (!empresaId) {
      setBadges(null)
      return
    }
    let cancelled = false

    async function fetchBadges() {
      try {
        const res = await fetch(`/api/dashboard/badges?empresaId=${empresaId}`, {
          credentials: 'include',
        })
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) setBadges(data)
      } catch {
        // silencia — badges são best-effort
      }
    }

    fetchBadges()
    const interval = setInterval(fetchBadges, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [empresaId])

  return badges
}
