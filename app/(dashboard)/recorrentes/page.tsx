'use client'

// Sprint 4.0.1.b — Lista de schedules recorrentes.

import { useEffect, useState, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, RefreshCw, Repeat, Power } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Header } from '@/components/layout/header'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'

interface Schedule {
  id: string
  description: string
  amount: number
  type: string
  frequency: string
  dayOfMonth: number | null
  dayOfWeek: number | null
  startDate: string
  endDate: string | null
  active: boolean
  lastGeneratedAt: string | null
  category: { id: string; name: string; color: string } | null
  supplier: { id: string; razaoSocial: string } | null
  customer: { id: string; razaoSocial: string } | null
  _count: { transactions: number }
}

interface Empresa { id: string; name: string; tradeName: string | null }

const DOW_LABELS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

export default function RecorrentesPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Carregando…</div>}>
      <RecorrentesInner />
    </Suspense>
  )
}

function RecorrentesInner() {
  const router = useRouter()
  const { toast } = useToast()
  const searchParams = useSearchParams()

  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaId, setEmpresaId] = useState<string>(searchParams.get('empresaId') ?? '')

  // Sprint 5.0.3.3 — Sincroniza state com searchParams.empresaId quando
  // WorkspaceSwitcher troca empresa (router.replace).
  useEffect(() => {
    const urlEmpresaId = searchParams.get('empresaId') ?? ''
    if (urlEmpresaId && urlEmpresaId !== empresaId) {
      setEmpresaId(urlEmpresaId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [type, setType] = useState<string>('TODOS')
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    fetch('/api/empresas')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.empresas) {
          setEmpresas(data.empresas)
          if (!empresaId && data.empresas.length === 1) {
            setEmpresaId(data.empresas[0].id)
          }
        }
      })
  }, [empresaId])

  const fetchSchedules = useCallback(async () => {
    if (!empresaId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const qs = new URLSearchParams({ empresaId })
      if (type !== 'TODOS') qs.set('type', type)

      const res = await fetch(`/api/recorrentes?${qs}`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setSchedules(data.schedules)
      }
    } finally {
      setLoading(false)
    }
  }, [empresaId, type])

  useEffect(() => { fetchSchedules() }, [fetchSchedules])

  useEffect(() => {
    if (!empresaId) return
    const sp = new URLSearchParams()
    sp.set('empresaId', empresaId)
    router.replace(`?${sp}`, { scroll: false })
  }, [empresaId, router])

  async function gerarAgora() {
    if (!empresaId) return
    setGenerating(true)
    try {
      const res = await fetch('/api/recorrentes/generate-now', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresaId, windowDays: 7 }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({
          variant: 'destructive',
          title: 'Falha ao gerar',
          description: data.erro ?? `HTTP ${res.status}`,
        })
        return
      }
      const r = data.result
      toast({
        title: `${r.generated} tx gerada${r.generated === 1 ? '' : 's'}`,
        description:
          r.skippedDuplicate > 0
            ? `${r.skippedDuplicate} já existia${r.skippedDuplicate === 1 ? '' : 'm'} (anti-dup)`
            : undefined,
      })
      void fetchSchedules()
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha de rede.' })
    } finally {
      setGenerating(false)
    }
  }

  async function togglePause(s: Schedule) {
    try {
      const res = await fetch(`/api/recorrentes/${s.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !s.active }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast({
          variant: 'destructive',
          title: 'Falha',
          description: data.erro ?? `HTTP ${res.status}`,
        })
        return
      }
      toast({ title: s.active ? 'Pausado' : 'Reativado' })
      void fetchSchedules()
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha de rede.' })
    }
  }

  function frequencyLabel(s: Schedule): string {
    switch (s.frequency) {
      case 'MONTHLY': return `Mensal, dia ${s.dayOfMonth}`
      case 'WEEKLY': return `Semanal, toda ${DOW_LABELS[s.dayOfWeek ?? 0]}`
      case 'QUARTERLY': return `Trimestral, dia ${s.dayOfMonth}`
      case 'YEARLY': return `Anual, dia ${s.dayOfMonth}`
      default: return s.frequency
    }
  }

  return (
    <div className="space-y-6">
      <Header
        title="Recorrentes"
        description={
          empresaId
            ? `${schedules.length} schedule${schedules.length !== 1 ? 's' : ''}. Geração automática diária 06:00.`
            : 'Selecione uma empresa pra ver recorrentes'
        }
      >
        <Button
          size="sm"
          variant="outline"
          onClick={gerarAgora}
          disabled={!empresaId || generating}
          title="Dispara o gerador agora, sem esperar o cron diário"
        >
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${generating ? 'animate-spin' : ''}`} />
          {generating ? 'Gerando…' : 'Gerar agora'}
        </Button>
        <Button size="sm" asChild disabled={!empresaId}>
          <Link href={`/recorrentes/novo${empresaId ? `?empresaId=${empresaId}` : ''}`}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Novo recorrente
          </Link>
        </Button>
      </Header>

      {empresas.length > 1 && (
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Empresa:</span>
              <Select value={empresaId} onValueChange={setEmpresaId}>
                <SelectTrigger className="w-auto min-w-[280px]">
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.tradeName ?? e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {empresaId && (
        <>
          <Card>
            <CardContent className="py-3">
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="w-auto min-w-[150px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos tipos</SelectItem>
                  <SelectItem value="PAYABLE">A pagar</SelectItem>
                  <SelectItem value="RECEIVABLE">A receber</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : schedules.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Repeat className="h-10 w-10 mx-auto mb-2" />
                <p className="text-sm">
                  Nenhum recorrente cadastrado.{' '}
                  <Link
                    href={`/recorrentes/novo?empresaId=${empresaId}`}
                    className="text-primary hover:underline"
                  >
                    Cadastrar primeiro
                  </Link>
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="border rounded-lg overflow-hidden bg-card">
              {schedules.map((s, i) => (
                <div
                  key={s.id}
                  className={`flex items-center gap-3 px-4 py-3 hover:bg-muted/30 ${i > 0 ? 'border-t' : ''} ${!s.active ? 'opacity-50' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{s.description}</p>
                      <Badge
                        variant={s.type === 'PAYABLE' ? 'destructive' : 'secondary'}
                        className="text-xs shrink-0"
                      >
                        {s.type === 'PAYABLE' ? 'A pagar' : 'A receber'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap text-xs text-muted-foreground">
                      <span>{frequencyLabel(s)}</span>
                      {s.lastGeneratedAt && (
                        <span>· última geração {new Date(s.lastGeneratedAt).toLocaleDateString('pt-BR')}</span>
                      )}
                      <span>· {s._count.transactions} tx geradas</span>
                      {s.category && (
                        <span className="flex items-center gap-1">
                          ·
                          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.category.color }} />
                          {s.category.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 font-semibold text-sm ${s.type === 'PAYABLE' ? 'text-red-600' : 'text-emerald-600'}`}
                  >
                    {s.type === 'PAYABLE' ? '−' : '+'} {formatBRL(s.amount)}
                  </span>
                  {!s.active && <Badge variant="outline" className="text-xs">Pausado</Badge>}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => togglePause(s)}
                    title={s.active ? 'Pausar' : 'Reativar'}
                  >
                    <Power className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
