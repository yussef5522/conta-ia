// Fase 5 — Tela de revisão dos alertas de monitoramento.

'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TrendingUp, X, ArrowLeft } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

interface Alert {
  id: string
  metricKey: string
  label: string
  valueOntem: number
  valueHoje: number
  delta: number
  detectedAt: string
}

export default function MonitorAlertsPage() {
  const { id: empresaId } = useParams<{ id: string }>()
  const { toast } = useToast()
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)

  const fetchAlerts = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/monitor-alerts?empresaId=${empresaId}`, {
        credentials: 'include',
      })
      const data = await res.json()
      setAlerts(data.alerts ?? [])
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao carregar alertas.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAlerts()
  }, [empresaId])

  async function handleDismiss(alertId: string) {
    setActing(alertId)
    try {
      const res = await fetch(`/api/monitor-alerts/${alertId}/dismiss`, {
        method: 'POST', credentials: 'include',
      })
      if (!res.ok) throw new Error('Erro')
      toast({
        variant: 'success', title: 'Alerta dispensado',
        description: 'Não vai mostrar de novo até a métrica MUDAR.',
      })
      setAlerts((prev) => prev.filter((a) => a.id !== alertId))
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao dispensar.' })
    } finally {
      setActing(null)
    }
  }

  return (
    <div className="container mx-auto max-w-3xl space-y-4 px-4 py-6">
      <Link href={`/empresas/${empresaId}`} className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <div className="flex items-center gap-3 border-b border-orange-200 pb-4">
        <TrendingUp className="h-6 w-6 text-orange-600" />
        <div>
          <h1 className="text-xl font-bold">Métricas que pioraram</h1>
          <p className="text-sm text-slate-600">
            Detectadas pelo monitor diário. Dispensar até nova mudança = não te avisa de novo até o valor MUDAR.
          </p>
        </div>
      </div>

      {loading && <p className="text-sm text-slate-500">Carregando…</p>}

      {!loading && alerts.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-slate-600">🎉 Nenhum alerta pendente.</p>
          </CardContent>
        </Card>
      )}

      {alerts.map((a) => (
        <Card key={a.id} className="border-orange-200 bg-orange-50/50">
          <CardContent className="space-y-3 py-4">
            <div className="text-sm">
              <p className="text-xs font-medium uppercase text-orange-700">
                Métrica {a.metricKey}
              </p>
              <p className="font-medium text-orange-900">{a.label}</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded border border-slate-200 bg-white px-3 py-2 text-sm">
                <span className="text-slate-500">ontem:</span>{' '}
                <span className="font-medium">{a.valueOntem}</span>
              </div>
              <span className="text-slate-400">→</span>
              <div className="rounded border border-orange-300 bg-orange-100 px-3 py-2 text-sm">
                <span className="text-orange-700">hoje:</span>{' '}
                <span className="font-medium text-orange-900">{a.valueHoje}</span>
              </div>
              <span className="text-sm font-medium text-orange-700">+{a.delta}</span>
            </div>

            <div className="flex justify-end">
              <Button
                variant="outline" size="sm"
                onClick={() => handleDismiss(a.id)}
                disabled={acting === a.id}
              >
                <X className="mr-2 h-4 w-4" /> Dispensar até nova mudança
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
