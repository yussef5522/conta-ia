'use client'

// Sprint 4.0.3 — hook que faz polling de /api/dashboard/badges a cada 60s.
// Recebe empresaId opcional; só busca quando definido.

import { useEffect, useState } from 'react'

export interface SidebarBadges {
  contasAPagar: { vencidas: number; vencendoEm3Dias: number }
  // Sprint Fix-Badge-Contas-Pagar (05/07/2026): contador análogo pra menu
  // "Contas a Receber" — antes as tx RECEIVABLE somavam no badge de "Contas
  // a Pagar" (bug). Opcional porque hooks antigos podem receber payload sem.
  contasAReceber?: { vencidas: number; vencendoEm3Dias: number }
  /**
   * ⭐ `pendentes` = CONTAS a pagar com par sugerido (os 3 stats do topo da tela).
   * ⭐ `caixa` = LINHAS do extrato esperando decisão — **é este que vira o badge do menu**
   * desde a faxina de 15/09, quando a tela dos Pendentes morreu. Os dois NÃO se somam:
   * são unidades diferentes do mesmo trabalho (ver o comentário no `global-sidebar`).
   */
  conciliacao: { pendentes: number; caixa: number }
  // Sprint 5.0.2.h — Transações com status PENDING (precisam categorizar)
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
