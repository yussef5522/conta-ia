'use client'

// Sprint 4.0.2 + Sprint A-effected Fase 1+2 — Página /conciliacao.
//
// 4 abas de confiança (estilo Botkeeper) + Já Conciliado:
//   🟢 Alta confiança (≥90) — pré-classificados, BULK APPROVE
//   🟡 Revisar (70-89)      — confirmar manualmente, 1-a-1
//   ⚪ Sem match (<70)       — OFX sem candidato bom
//   ✓ Já conciliado         — histórico com Desfazer
//
// Banner de saldo no topo. Filtro de período. Candidatos top filtrados a
// score >= 70 (esconde poluição).

import { useEffect, useState, useCallback, Suspense, useMemo } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeftRight, Sparkles, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Header } from '@/components/layout/header'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'
import { MatchCard } from '@/components/conciliacao/match-card'
import { BalanceBanner } from '@/components/conciliacao/balance-banner'
import { HistoricoTable } from '@/components/conciliacao/historico-table'
import {
  ConfidenceList,
  type ConfidencePair,
} from '@/components/conciliacao/confidence-list'
import { BulkDryRunModal } from '@/components/conciliacao/bulk-dry-run-modal'

// Score mínimo pra entrar na pré-classificação (esconde "TIELE/THIAGO").
const DRY_RUN_MIN_SCORE = 70
const HIGH_CONFIDENCE_THRESHOLD = 90

interface Empresa { id: string; name: string; tradeName: string | null }

interface OfxTx {
  id: string
  description: string
  amount: number
  date: string
  type: string
  bankAccount: { name: string; bankName: string | null } | null
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

  useEffect(() => {
    const urlEmpresaId = searchParams.get('empresaId') ?? ''
    if (urlEmpresaId && urlEmpresaId !== empresaId) {
      setEmpresaId(urlEmpresaId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const [ofxTxs, setOfxTxs] = useState<OfxTx[]>([])
  const [loadingOfx, setLoadingOfx] = useState(true)
  const [periodo, setPeriodo] = useState<'30d' | '60d' | '90d' | 'mes' | 'todos'>('60d')

  // Sprint A-effected Fase 2 — Pares pré-classificados (≥70) carregados em
  // batch via /api/conciliacao/bulk-dry-run. Client divide em Alta e Revisar.
  const [dryRunPairs, setDryRunPairs] = useState<ConfidencePair[]>([])
  const [dryRunLoading, setDryRunLoading] = useState(false)

  // Bulk modal (revisão pré-aplicação)
  const [bulkOpen, setBulkOpen] = useState(false)

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

  function periodoToRange(p: typeof periodo): { inicio?: string; fim?: string } {
    if (p === 'todos') return {}
    const now = new Date()
    const fim = now.toISOString().slice(0, 10)
    if (p === 'mes') {
      const ym = new Date(now.getFullYear(), now.getMonth(), 1)
      return { inicio: ym.toISOString().slice(0, 10), fim }
    }
    const days = p === '30d' ? 30 : p === '60d' ? 60 : 90
    const inicio = new Date(now.getTime() - days * 86400000).toISOString().slice(0, 10)
    return { inicio, fim }
  }

  const fetchOfxTxs = useCallback(async () => {
    if (!empresaId) {
      setLoadingOfx(false)
      return
    }
    setLoadingOfx(true)
    try {
      const qs = new URLSearchParams({ empresaId, limit: '200' })
      const { inicio, fim } = periodoToRange(periodo)
      if (inicio) qs.set('inicio', inicio)
      if (fim) qs.set('fim', fim)
      const res = await fetch(`/api/transacoes?${qs}`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setOfxTxs(data.transacoes.filter((t: { origin: string }) => t.origin === 'OFX'))
      }
    } finally {
      setLoadingOfx(false)
    }
  }, [empresaId, periodo])

  const fetchDryRun = useCallback(async () => {
    if (!empresaId) return
    setDryRunLoading(true)
    try {
      const res = await fetch(
        `/api/conciliacao/bulk-dry-run?empresaId=${empresaId}&minScore=${DRY_RUN_MIN_SCORE}`,
        { credentials: 'include' },
      )
      if (res.ok) {
        const data = await res.json()
        setDryRunPairs(data.pairs as ConfidencePair[])
      }
    } finally {
      setDryRunLoading(false)
    }
  }, [empresaId])

  useEffect(() => {
    fetchOfxTxs()
  }, [fetchOfxTxs])

  useEffect(() => {
    fetchDryRun()
  }, [fetchDryRun])

  useEffect(() => {
    if (!empresaId) return
    const sp = new URLSearchParams()
    sp.set('empresaId', empresaId)
    router.replace(`?${sp}`, { scroll: false })
  }, [empresaId, router])

  // Split client-side: ≥90 → Alta, 70-89 → Revisar
  const { altaPairs, revisarPairs, ofxIdsWithMatch, semMatchOfxs } = useMemo(() => {
    const alta: ConfidencePair[] = []
    const revisar: ConfidencePair[] = []
    const idsWithMatch = new Set<string>()
    for (const p of dryRunPairs) {
      idsWithMatch.add(p.ofx.id)
      if (p.score >= HIGH_CONFIDENCE_THRESHOLD) alta.push(p)
      else revisar.push(p)
    }
    const semMatch = ofxTxs.filter((t) => !idsWithMatch.has(t.id))
    return {
      altaPairs: alta,
      revisarPairs: revisar,
      ofxIdsWithMatch: idsWithMatch,
      semMatchOfxs: semMatch,
    }
  }, [dryRunPairs, ofxTxs])

  function refresh() {
    void fetchOfxTxs()
    void fetchDryRun()
  }

  return (
    <div className="space-y-6">
      <Header
        title="Conciliação"
        description={
          empresaId
            ? `${ofxTxs.length} transação${ofxTxs.length === 1 ? '' : 'ões'} no extrato`
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

      {empresaId && <BalanceBanner empresaId={empresaId} />}

      {empresaId && (
        <Tabs defaultValue="alta" className="space-y-4">
          <TabsList className="grid w-full max-w-2xl grid-cols-4">
            <TabsTrigger value="alta">
              🟢 Alta ({dryRunLoading ? '…' : altaPairs.length})
            </TabsTrigger>
            <TabsTrigger value="revisar">
              🟡 Revisar ({dryRunLoading ? '…' : revisarPairs.length})
            </TabsTrigger>
            <TabsTrigger value="sem-match">
              ⚪ Sem match ({loadingOfx || dryRunLoading ? '…' : semMatchOfxs.length})
            </TabsTrigger>
            <TabsTrigger value="conciliadas">
              ✓ Conciliado
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Período:</span>
            <Select value={periodo} onValueChange={(v) => setPeriodo(v as typeof periodo)}>
              <SelectTrigger className="w-auto min-w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mes">Mês corrente</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
                <SelectItem value="60d">Últimos 60 dias</SelectItem>
                <SelectItem value="90d">Últimos 90 dias</SelectItem>
                <SelectItem value="todos">Todos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 🟢 ALTA CONFIANÇA */}
          <TabsContent value="alta" className="space-y-4">
            {dryRunLoading ? (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  <Sparkles className="h-6 w-6 mx-auto mb-2 animate-pulse" />
                  Classificando candidatos...
                </CardContent>
              </Card>
            ) : (
              <>
                {altaPairs.length > 0 && (
                  <div className="flex items-center justify-between gap-3 border rounded-lg bg-emerald-50/50 border-emerald-200 p-3">
                    <div className="text-sm">
                      <strong>{altaPairs.length} pares</strong> com alta confiança
                      ({altaPairs.length === 0 ? 'R$ 0,00' : formatBRL(altaPairs.reduce((acc, p) => acc + Math.abs(p.ofx.amount), 0))}).
                      Revise antes de aplicar em lote.
                    </div>
                    <Button onClick={() => setBulkOpen(true)}>
                      Revisar e conciliar em lote →
                    </Button>
                  </div>
                )}
                <ConfidenceList
                  pairs={altaPairs}
                  emptyMessage="Nenhum match com score ≥ 90 no momento. Verifique a aba 'Revisar' pra os candidatos 70-89."
                  onConciliated={refresh}
                />
              </>
            )}
          </TabsContent>

          {/* 🟡 REVISAR */}
          <TabsContent value="revisar" className="space-y-4">
            {dryRunLoading ? (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  <Sparkles className="h-6 w-6 mx-auto mb-2 animate-pulse" />
                  Classificando candidatos...
                </CardContent>
              </Card>
            ) : (
              <ConfidenceList
                pairs={revisarPairs}
                emptyMessage="Nenhum match na faixa 70-89."
                onConciliated={refresh}
              />
            )}
          </TabsContent>

          {/* ⚪ SEM MATCH */}
          <TabsContent value="sem-match" className="space-y-4">
            {loadingOfx ? (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  Carregando...
                </CardContent>
              </Card>
            ) : semMatchOfxs.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-emerald-600" />
                  Todas as transações do extrato têm candidatos compatíveis.
                </CardContent>
              </Card>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  Transações OFX que não têm conta a pagar/receber compatível no
                  sistema (score &lt; 70). Use os botões abaixo (ações virão na
                  Fase 4) ou cadastre manualmente uma conta nova.
                </p>
                <div className="border rounded-lg bg-card divide-y">
                  {semMatchOfxs.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center gap-3 px-3 py-2.5"
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
                        className={`shrink-0 font-semibold text-sm tabular-nums ${
                          t.type === 'CREDIT' ? 'text-emerald-600' : 'text-red-600'
                        }`}
                      >
                        {t.type === 'CREDIT' ? '+' : '−'} {formatBRL(t.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </TabsContent>

          {/* ✓ JÁ CONCILIADO */}
          <TabsContent value="conciliadas" className="space-y-4">
            <HistoricoTable
              empresaId={empresaId}
              onAfterUndo={refresh}
            />
          </TabsContent>
        </Tabs>
      )}

      {empresaId && (
        <BulkDryRunModal
          empresaId={empresaId}
          open={bulkOpen}
          onClose={() => setBulkOpen(false)}
          onAfterBulk={refresh}
          minScore={HIGH_CONFIDENCE_THRESHOLD}
        />
      )}
    </div>
  )
}
