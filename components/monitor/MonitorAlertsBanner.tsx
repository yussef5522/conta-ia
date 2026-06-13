// Fase 5 — Banner global de monitoramento. Aparece quando métricas pioram.

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { TrendingUp } from 'lucide-react'

interface Alert {
  id: string
  metricKey: string
  label: string
  valueOntem: number
  valueHoje: number
  delta: number
  detectedAt: string
}

interface Props {
  empresaId: string | null
}

export function MonitorAlertsBanner({ empresaId }: Props) {
  const [alerts, setAlerts] = useState<Alert[]>([])

  useEffect(() => {
    if (!empresaId) return
    let aborted = false
    const fetchAlerts = async () => {
      try {
        const res = await fetch(`/api/monitor-alerts?empresaId=${empresaId}`, {
          credentials: 'include',
        })
        if (!res.ok) return
        const data = await res.json()
        if (aborted) return
        setAlerts(data.alerts ?? [])
      } catch {
        // ignora
      }
    }
    fetchAlerts()
    const interval = setInterval(fetchAlerts, 5 * 60_000)  // polling 5min
    return () => { aborted = true; clearInterval(interval) }
  }, [empresaId])

  if (!empresaId || alerts.length === 0) return null

  const primaria = alerts[0]
  const restante = alerts.length - 1

  return (
    <div
      className="flex items-center gap-3 border-b border-orange-300 bg-orange-50 px-4 py-2 text-sm text-orange-900"
      data-testid="monitor-alerts-banner"
    >
      <TrendingUp className="h-4 w-4 flex-shrink-0 text-orange-600" />
      <p className="flex-1">
        <span className="font-medium">{alerts.length} métrica{alerts.length > 1 ? 's' : ''} piorou desde ontem.</span>{' '}
        {primaria.label}: <strong>{primaria.valueOntem} → {primaria.valueHoje}</strong>
        {restante > 0 && ` (+ ${restante} outra${restante > 1 ? 's' : ''})`}.
      </p>
      <Link
        href={`/empresas/${empresaId}/monitor-alerts`}
        className="rounded border border-orange-700 px-3 py-1 font-medium text-orange-900 hover:bg-orange-100"
      >
        Revisar →
      </Link>
    </div>
  )
}
