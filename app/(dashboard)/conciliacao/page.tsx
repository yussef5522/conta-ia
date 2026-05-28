'use client'

// Sprint 4.0.2 — Página /conciliacao backup.
// Lista tx OFX não conciliadas + ao clicar mostra candidatos rankeados.

import { useEffect, useState, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeftRight, Sparkles, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Header } from '@/components/layout/header'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'
import { MatchCard } from '@/components/conciliacao/match-card'

interface Empresa { id: string; name: string; tradeName: string | null }

interface OfxTx {
  id: string
  description: string
  amount: number
  date: string
  type: string
  bankAccount: { name: string; bankName: string | null } | null
}

interface MatchResult {
  candidateId: string
  score: number
  reasoning: string[]
  candidate: {
    id: string
    description: string
    amount: number
    dueDate: string | null
    lifecycle: string
  }
}

export default function ConciliacaoPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Carregando…</div>}>
      <ConciliacaoInner />
    </Suspense>
  )
}

function ConciliacaoInner() {
  const router = useRouter()
  const { toast } = useToast()
  const searchParams = useSearchParams()

  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaId, setEmpresaId] = useState<string>(searchParams.get('empresaId') ?? '')

  // Sprint 5.0.3.3 — Sincroniza state com searchParams.empresaId quando
  // WorkspaceSwitcher troca empresa.
  useEffect(() => {
    const urlEmpresaId = searchParams.get('empresaId') ?? ''
    if (urlEmpresaId && urlEmpresaId !== empresaId) {
      setEmpresaId(urlEmpresaId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const [ofxTxs, setOfxTxs] = useState<OfxTx[]>([])
  const [loading, setLoading] = useState(true)

  const [selected, setSelected] = useState<OfxTx | null>(null)
  const [matches, setMatches] = useState<MatchResult[]>([])
  const [matchLoading, setMatchLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)

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

  const fetchOfxTxs = useCallback(async () => {
    if (!empresaId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      // Reusa /api/transacoes: lifecycle=EFFECTED, origem=OFX, sem reconciledWithId
      const qs = new URLSearchParams({ empresaId, limit: '100' })
      const res = await fetch(`/api/transacoes?${qs}`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        // Filtra cliente-side por enquanto: tx EFFECTED + sem conciliação
        // (endpoint /api/transacoes não retorna reconciledWithId — limita aqui)
        setOfxTxs(data.transacoes.filter((t: { origin: string }) => t.origin === 'OFX'))
      }
    } finally {
      setLoading(false)
    }
  }, [empresaId])

  useEffect(() => { fetchOfxTxs() }, [fetchOfxTxs])

  useEffect(() => {
    if (!empresaId) return
    const sp = new URLSearchParams()
    sp.set('empresaId', empresaId)
    router.replace(`?${sp}`, { scroll: false })
  }, [empresaId, router])

  async function buscarCandidatos(tx: OfxTx) {
    setSelected(tx)
    setMatches([])
    setMatchLoading(true)
    try {
      const res = await fetch('/api/conciliacao/match', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ofxTransactionId: tx.id }),
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
      // matches vem do backend; enriquece com candidate metadata via 2ª query
      const enriched: MatchResult[] = []
      for (const m of data.matches.slice(0, 5)) {
        // O endpoint /match retorna candidateId mas não os meta — buscar individual
        const r = await fetch(`/api/transacoes/${m.candidateId}`, { credentials: 'include' })
        if (r.ok) {
          const td = await r.json()
          enriched.push({
            candidateId: m.candidateId,
            score: m.score,
            reasoning: m.reasoning,
            candidate: {
              id: td.transacao.id,
              description: td.transacao.description,
              amount: td.transacao.amount,
              dueDate: td.transacao.dueDate,
              lifecycle: td.transacao.lifecycle,
            },
          })
        }
      }
      setMatches(enriched)
    } finally {
      setMatchLoading(false)
    }
  }

  async function confirmar(m: MatchResult) {
    if (!selected) return
    setConfirming(true)
    try {
      const res = await fetch('/api/conciliacao/confirmar', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ofxTransactionId: selected.id,
          candidateId: m.candidateId,
        }),
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
      toast({ title: 'Conciliada', description: selected.description })
      setSelected(null)
      setMatches([])
      void fetchOfxTxs()
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="space-y-6">
      <Header
        title="Conciliação"
        description={
          empresaId
            ? `${ofxTxs.length} transação${ofxTxs.length === 1 ? '' : 'ões'} OFX disponível${ofxTxs.length === 1 ? '' : 'eis'}`
            : 'Selecione uma empresa pra ver as transações'
        }
      />

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
        <div className="grid lg:grid-cols-2 gap-6">
          {/* ESQUERDA: lista OFX */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase text-muted-foreground">
              Extrato bancário
            </h2>
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : ofxTxs.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground text-sm">
                  Nenhuma tx OFX disponível.
                </CardContent>
              </Card>
            ) : (
              <div className="border rounded-lg bg-card divide-y">
                {ofxTxs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => buscarCandidatos(t)}
                    className={`w-full text-left flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40 transition-colors ${selected?.id === t.id ? 'bg-primary/5' : ''}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{t.description}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{new Date(t.date).toLocaleDateString('pt-BR')}</span>
                        {t.bankAccount && (
                          <span>· {t.bankAccount.bankName ?? t.bankAccount.name}</span>
                        )}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 font-semibold text-sm ${t.type === 'CREDIT' ? 'text-emerald-600' : 'text-red-600'}`}
                    >
                      {t.type === 'CREDIT' ? '+' : '−'} {formatBRL(t.amount)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* DIREITA: candidatos */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase text-muted-foreground">
              Candidatos a conciliação
            </h2>
            {!selected ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground text-sm">
                  <ArrowLeftRight className="h-10 w-10 mx-auto mb-2" />
                  Clique numa tx do extrato pra ver candidatos.
                </CardContent>
              </Card>
            ) : matchLoading ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground text-sm">
                  <Sparkles className="h-6 w-6 mx-auto mb-2 animate-pulse" />
                  Calculando matches…
                </CardContent>
              </Card>
            ) : matches.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground text-sm">
                  <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-emerald-600" />
                  Nenhuma conta pendente compatível com essa tx.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {matches.map((m) => (
                  <div key={m.candidateId} className="space-y-2">
                    <MatchCard
                      ofx={{
                        id: selected.id,
                        description: selected.description,
                        amount: selected.amount,
                        date: selected.date,
                        type: selected.type,
                      }}
                      candidate={m.candidate}
                      score={m.score}
                      reasoning={m.reasoning}
                      selected={false}
                      onToggle={() => {}}
                      recommendation={
                        m.score >= 90 ? 'AUTO_RECONCILE' : m.score >= 70 ? 'CONFIRM' : 'NO_MATCH'
                      }
                    />
                    <div className="flex justify-end">
                      <Button size="sm" onClick={() => confirmar(m)} disabled={confirming}>
                        {confirming ? 'Conciliando…' : 'Conciliar'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
