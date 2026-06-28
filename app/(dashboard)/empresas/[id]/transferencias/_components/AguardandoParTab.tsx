// Sprint Pending Transfer State (27/06/2026, modelo QuickBooks/Xero).
// Aba "Aguardando par" — tx marcadas como TRANSFER no preview que ainda
// não tem o par real. Já saíram do DRE / filas. Aqui o user pode:
//   - Casar com 1 clique (quando há sugestão verde)
//   - Marcar "não é transferência" (volta a ser categorizável)

'use client'

import { useEffect, useState } from 'react'
import { ArrowLeftRight, X, Check, Loader2, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'

interface Sugestao {
  candidateId: string
  candidateDate: string
  candidateAccountId: string
  candidateAccountName: string
  candidateDescription: string
}

interface Item {
  id: string
  date: string
  type: 'CREDIT' | 'DEBIT' | 'TRANSFER'
  amount: number
  description: string
  direction: 'IN' | 'OUT' | null
  since: string | null
  account: { id: string; name: string; bankName: string | null } | null
  sugestoes: Sugestao[]
}

interface AguardandoParResponse {
  items: Item[]
  kpis: {
    total: number
    somaSaidas: number
    somaEntradas: number
    comSugestao: number
  }
}

export function AguardandoParTab({ empresaId }: { empresaId: string }) {
  const { toast } = useToast()
  const [data, setData] = useState<AguardandoParResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  async function reload() {
    setLoading(true)
    try {
      const res = await fetch(`/api/empresas/${empresaId}/transferencias/aguardando-par`, {
        credentials: 'include',
      })
      if (!res.ok) {
        setData({ items: [], kpis: { total: 0, somaSaidas: 0, somaEntradas: 0, comSugestao: 0 } })
        return
      }
      setData(await res.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
  }, [empresaId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function dismissNotTransfer(itemId: string) {
    setActing(itemId)
    try {
      const res = await fetch(`/api/transferencias/aguardando-par/${itemId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        toast({ variant: 'destructive', title: 'Erro', description: d.erro ?? 'Falha ao desmarcar' })
        return
      }
      toast({ variant: 'success', title: 'Voltou pra categorização', description: 'Tx pode ser categorizada normalmente agora.' })
      await reload()
    } finally {
      setActing(null)
    }
  }

  async function pairWith(itemId: string, candidateId: string) {
    setActing(itemId)
    try {
      const res = await fetch(`/api/transferencias/aguardando-par/${itemId}/pair`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pairTxId: candidateId }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        toast({ variant: 'destructive', title: 'Erro', description: d.erro ?? 'Falha ao parear' })
        return
      }
      toast({
        variant: 'success',
        title: 'Transferência casada',
        description: 'Os 2 lados viraram TRANSFER. Fora do DRE.',
      })
      await reload()
    } finally {
      setActing(null)
    }
  }

  function toggleExpanded(itemId: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }

  if (loading && !data) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 mx-auto animate-spin" />
          <p className="mt-2">Carregando…</p>
        </CardContent>
      </Card>
    )
  }

  if (!data || data.items.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <ArrowLeftRight className="h-8 w-8 mx-auto mb-3 text-emerald-500" />
          <p className="text-sm font-medium">Nenhuma transferência aguardando par</p>
          <p className="text-xs mt-1">Tudo casado ou em ordem.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Aguardando" value={data.kpis.total.toString()} tone="amber" />
        <KPI label="Saídas" value={formatBRL(data.kpis.somaSaidas)} tone="red" />
        <KPI label="Entradas" value={formatBRL(data.kpis.somaEntradas)} tone="emerald" />
        <KPI label="Com sugestão" value={data.kpis.comSugestao.toString()} tone="blue" />
      </div>

      {/* Lista */}
      <Card>
        <CardContent className="pt-4 space-y-2">
          {data.items.map((item) => {
            const isExp = expanded.has(item.id)
            const directionLabel = item.direction === 'OUT' || item.type === 'DEBIT' ? 'Saiu' : 'Entrou'
            const directionTone = directionLabel === 'Saiu' ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'

            return (
              <div
                key={item.id}
                className="border rounded-lg p-3 bg-amber-50/20 dark:bg-amber-950/10 border-amber-200/40 dark:border-amber-900/30"
              >
                <div className="flex items-center gap-3">
                  {item.sugestoes.length > 0 ? (
                    <button onClick={() => toggleExpanded(item.id)} className="text-muted-foreground hover:text-foreground">
                      {isExp ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                  ) : (
                    <span className="w-4" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground tabular-nums">{fmtDateBR(item.date)}</span>
                      <span className={`text-[10px] uppercase font-semibold ${directionTone}`}>
                        {directionLabel}
                      </span>
                      <span className="text-sm font-medium truncate">{item.description}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.account?.name} {item.account?.bankName && `· ${item.account.bankName}`}
                      {item.since && ` · aguardando desde ${fmtDateBR(item.since)}`}
                    </p>
                  </div>
                  <span className={`text-sm font-semibold tabular-nums ${directionTone}`}>
                    {directionLabel === 'Saiu' ? '− ' : '+ '}{formatBRL(item.amount)}
                  </span>
                  {item.sugestoes.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold px-2 py-0.5">
                      {item.sugestoes.length} match
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => dismissNotTransfer(item.id)}
                    disabled={acting === item.id}
                    title="Não é transferência"
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5 mr-1" />
                    Não é transferência
                  </Button>
                </div>

                {isExp && item.sugestoes.length > 0 && (
                  <div className="mt-3 pl-7 space-y-2 border-t pt-3">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                      Sugestões de par
                    </p>
                    {item.sugestoes.map((s) => (
                      <div
                        key={s.candidateId}
                        className="flex items-center gap-3 bg-emerald-50/40 dark:bg-emerald-950/15 border border-emerald-200/40 dark:border-emerald-900/30 rounded p-2"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs">
                            <span className="text-muted-foreground tabular-nums">{fmtDateBR(s.candidateDate)}</span>
                            {' · '}
                            <span className="font-medium">{s.candidateAccountName}</span>
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                            {s.candidateDescription}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => pairWith(item.id, s.candidateId)}
                          disabled={acting === item.id}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          {acting === item.id ? (
                            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5 mr-1" />
                          )}
                          Casar
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}

function KPI({ label, value, tone }: { label: string; value: string; tone: 'amber' | 'red' | 'emerald' | 'blue' }) {
  const colorClass = {
    amber: 'text-amber-700 dark:text-amber-400',
    red: 'text-red-700 dark:text-red-400',
    emerald: 'text-emerald-700 dark:text-emerald-400',
    blue: 'text-blue-700 dark:text-blue-400',
  }[tone]
  return (
    <div className="rounded-lg border bg-card py-2 px-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
      <p className={`text-sm font-semibold tabular-nums ${colorClass}`}>{value}</p>
    </div>
  )
}

function fmtDateBR(iso: string): string {
  const d = new Date(iso)
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}`
}
