'use client'

// Sprint 4.0.4 — Preferências de email alerts.

import { useEffect, useState } from 'react'
import { Mail, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Header } from '@/components/layout/header'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'

interface Prefs {
  emailAlertsEnabled: boolean
  emailAlertsFrequency: 'DAILY' | 'WEEKLY' | 'NONE'
}

export default function AlertasConfigPage() {
  const { toast } = useToast()
  const [prefs, setPrefs] = useState<Prefs | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    fetch('/api/configuracoes/alertas', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setPrefs(data)
        setLoading(false)
      })
  }, [])

  async function salvar(patch: Partial<Prefs>) {
    if (!prefs) return
    const next = { ...prefs, ...patch }
    setPrefs(next)
    setSaving(true)
    try {
      const res = await fetch('/api/configuracoes/alertas', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast({
          variant: 'destructive',
          title: 'Falha ao salvar',
          description: data.erro ?? `HTTP ${res.status}`,
        })
        return
      }
      toast({ title: 'Preferências salvas' })
    } finally {
      setSaving(false)
    }
  }

  async function enviarTeste() {
    setTesting(true)
    try {
      const res = await fetch('/api/alerts/send-now', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true, dryRun: false }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({
          variant: 'destructive',
          title: 'Falha',
          description: data.erro ?? `HTTP ${res.status}`,
        })
        return
      }
      const r = data.result
      toast({
        title: `${r.emailsSent} email${r.emailsSent === 1 ? '' : 's'} enviado${r.emailsSent === 1 ? '' : 's'}`,
        description: r.emailsSkippedNoData
          ? `${r.emailsSkippedNoData} sem alertas ativos`
          : undefined,
      })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="space-y-6">
      <Header
        title="Alertas por email"
        description="Receba avisos automáticos sobre contas vencidas e vencendo"
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : !prefs ? (
        <p className="text-sm text-destructive">Não foi possível carregar preferências.</p>
      ) : (
        <Card>
          <CardContent className="py-6 space-y-5">
            <div className="flex items-start gap-3">
              <Checkbox
                checked={prefs.emailAlertsEnabled}
                onCheckedChange={(v) => salvar({ emailAlertsEnabled: !!v })}
                disabled={saving}
                id="enabled"
              />
              <div className="space-y-1">
                <label htmlFor="enabled" className="text-sm font-medium cursor-pointer">
                  Receber alertas por email
                </label>
                <p className="text-xs text-muted-foreground">
                  Aviso enviado quando há contas vencidas, vencendo em até 3 dias ou na semana.
                  Email NÃO é enviado quando não há nenhum alerta ativo.
                </p>
              </div>
            </div>

            {prefs.emailAlertsEnabled && (
              <div className="space-y-1.5 pl-7">
                <label className="text-xs">Frequência</label>
                <Select
                  value={prefs.emailAlertsFrequency}
                  onValueChange={(v) =>
                    salvar({ emailAlertsFrequency: v as Prefs['emailAlertsFrequency'] })
                  }
                  disabled={saving}
                >
                  <SelectTrigger className="w-auto min-w-[220px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DAILY">Diário — dias úteis 08:00</SelectItem>
                    <SelectItem value="WEEKLY">Semanal — toda segunda 08:00</SelectItem>
                    <SelectItem value="NONE">Não enviar (pausado)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="border-t pt-4 flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={enviarTeste}
                disabled={testing || !prefs.emailAlertsEnabled}
              >
                <Mail className="mr-1.5 h-3.5 w-3.5" />
                {testing ? (
                  <>
                    <RefreshCw className="mr-1 h-3.5 w-3.5 animate-spin" />
                    Enviando…
                  </>
                ) : (
                  'Enviar email de teste agora'
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                Útil pra confirmar que está chegando na sua caixa.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
