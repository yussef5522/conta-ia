'use client'

// Sprint A-effected Fase B.1 — Página /conciliacao no modelo Xero.
//
// 4 abas do Xero:
//   - Reconcile (default) — lista de statement lines com 4 ações por linha
//   - Cash coding         — placeholder Fase C (grid bulk pra varejo)
//   - Bank statements     — placeholder com link pra import OFX
//   - Account transactions — histórico de conciliadas (era "Já Conciliado")
//
// Topo sóbrio: Statement Balance / Balance in Xero / Diferença a conciliar.
// Filtros: Conta / Período / Tipo (Só pagamentos/Só recebimentos/Todos).

import { useEffect, useState, useCallback, Suspense, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Sparkles, CheckCircle2, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Header } from '@/components/layout/header'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useEmpresa } from '@/lib/contexts/empresa-context'
import { formatBRL } from '@/lib/format/money'
import { StatementBalanceHeader } from '@/components/conciliacao/statement-balance-header'
import { HistoricoTable } from '@/components/conciliacao/historico-table'
import { BulkDryRunModal } from '@/components/conciliacao/bulk-dry-run-modal'
import {
  XeroRow,
  type MatchSuggestion,
} from '@/components/conciliacao/xero-row'
import { TipoSelector } from '@/components/conciliacao/tipo-selector'
import {
  defaultTipoForCompany,
  parseTipoParam,
  type TipoConciliacao,
} from '@/lib/conciliacao/tipo-filter'

// Score mínimo pra entrar na pré-classificação (esconde "TIELE/THIAGO").
const DRY_RUN_MIN_SCORE = 70
const HIGH_CONFIDENCE_THRESHOLD = 90

interface Empresa {
  id: string
  name: string
  tradeName: string | null
  type: string | null
}

interface OfxTx {
  id: string
  description: string
  amount: number
  date: string
  type: string
  bankAccount: { name: string; bankName: string | null } | null
}

// Tipo local pra evitar import de ConfidenceList (Fase B descontinuada — XeroRow assume)
interface DryRunPair {
  ofx: { id: string; description: string; amount: number; date: string; type: string }
  candidate: {
    id: string
    description: string
    amount: number
    dueDate: string
    lifecycle: string
  }
  score: number
  reasoning: string[]
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
  const searchParams = useSearchParams()
  // Fonte única da empresa atual: WorkspaceSwitcher no topo (EmpresaContext).
  // URL ?empresaId= continua override pra deep-links antigos.
  const { currentEmpresaId: ctxEmpresaId } = useEmpresa()

  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaId, setEmpresaId] = useState<string>(
    searchParams.get('empresaId') ?? ctxEmpresaId ?? '',
  )

  useEffect(() => {
    const urlEmpresaId = searchParams.get('empresaId') ?? ''
    if (urlEmpresaId) {
      // URL é source-of-truth (deep-link). Vence o contexto.
      if (urlEmpresaId !== empresaId) setEmpresaId(urlEmpresaId)
    } else if (ctxEmpresaId && ctxEmpresaId !== empresaId) {
      // Sem URL: sincroniza com WorkspaceSwitcher (user trocou no topo).
      setEmpresaId(ctxEmpresaId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, ctxEmpresaId])

  const [ofxTxs, setOfxTxs] = useState<OfxTx[]>([])
  const [loadingOfx, setLoadingOfx] = useState(true)
  const [periodo, setPeriodo] = useState<'30d' | '60d' | '90d' | 'mes' | 'todos'>('60d')

  // Sprint A-effected Fase A — TIPO de conciliação. Bug 3 fix:
  // Removi o useEffect "setTipoInitialized(false) on empresaId" que causava
  // race entre estado da URL e heurística. Agora: 1) URL traz tipo → usa e
  // trava. 2) URL não traz → tipo='todos' temporário até heurística rodar
  // (só roda uma vez, marcada via tipoLocked).
  const [tipo, setTipo] = useState<TipoConciliacao>(
    parseTipoParam(searchParams.get('tipo')),
  )
  const [tipoLocked, setTipoLocked] = useState<boolean>(
    !!searchParams.get('tipo'),
  )

  // Wrapper: quando user troca manualmente, trava (heurística não sobrescreve)
  const setTipoUser = useCallback((next: TipoConciliacao) => {
    setTipo(next)
    setTipoLocked(true)
  }, [])

  // Sprint A-effected Fase 2 — Pares pré-classificados (≥70) carregados em
  // batch via /api/conciliacao/bulk-dry-run. Client divide em Alta e Revisar.
  const [dryRunPairs, setDryRunPairs] = useState<DryRunPair[]>([])
  const [dryRunLoading, setDryRunLoading] = useState(false)

  // Bulk modal (revisão pré-aplicação)
  const [bulkOpen, setBulkOpen] = useState(false)

  // Bug 3 fix v2: AbortController pra cancelar fetch anterior quando
  // tipo/periodo/empresaId muda. Sem isso, race condition: Promise A
  // (tipo='todos' inicial) resolve DEPOIS de Promise B (tipo='apenas-
  // pagamentos' após heurística) → setOfxTxs sobrescreve com dados antigos.
  const ofxAbortRef = useRef<AbortController | null>(null)
  const dryRunAbortRef = useRef<AbortController | null>(null)

  // Sprint A-effected Fase 2-fix — refreshKey força BalanceBanner a refetch
  // quando algo é conciliado/desfeito. Sem isso, banner ficaria parado
  // mostrando saldo antigo até F5 manual.
  const [refreshKey, setRefreshKey] = useState(0)

  // Sprint Conciliação-Visual: busca local sem refetch (preserva scroll
  // do update otimista). Filtra ofxTxs por descrição/valor/banco/conta.
  const [busca, setBusca] = useState('')

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

  // Sprint A-effected Fase A — heurística de default por companyType.
  // Bug 3 fix: roda APENAS se tipo não foi escolhido (tipoLocked=false).
  // O useEffect anterior `setTipoInitialized(false) on empresaId` foi REMOVIDO
  // — ele causava reset em mount inicial, sobrescrevendo URL param.
  useEffect(() => {
    if (tipoLocked || !empresaId || empresas.length === 0) return
    const empresa = empresas.find((e) => e.id === empresaId)
    if (!empresa) return
    const defaultTipo = defaultTipoForCompany(empresa.type)
    setTipo(defaultTipo)
    setTipoLocked(true)
  }, [empresaId, empresas, tipoLocked])

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
    // Bug 3 fix v2: aborta fetch anterior antes de disparar novo
    ofxAbortRef.current?.abort()
    const controller = new AbortController()
    ofxAbortRef.current = controller

    setLoadingOfx(true)
    try {
      const qs = new URLSearchParams({ empresaId, limit: '200', tipo })
      const { inicio, fim } = periodoToRange(periodo)
      if (inicio) qs.set('inicio', inicio)
      if (fim) qs.set('fim', fim)
      const res = await fetch(`/api/conciliacao/ofx-pendentes?${qs}`, {
        credentials: 'include',
        signal: controller.signal,
      })
      if (res.ok) {
        const data = await res.json()
        // Só aplica se ESTE controller ainda é o ativo (não foi sobrescrito)
        if (ofxAbortRef.current === controller) {
          setOfxTxs(data.transacoes)
        }
      }
    } catch (err) {
      // Aborted: silencia. Outros erros propagam logs do navegador.
      if ((err as Error)?.name !== 'AbortError') {
        throw err
      }
    } finally {
      if (ofxAbortRef.current === controller) {
        setLoadingOfx(false)
      }
    }
  }, [empresaId, periodo, tipo])

  const fetchDryRun = useCallback(async () => {
    if (!empresaId) return
    // Bug 3 fix v2: AbortController igual fetchOfxTxs
    dryRunAbortRef.current?.abort()
    const controller = new AbortController()
    dryRunAbortRef.current = controller

    setDryRunLoading(true)
    try {
      const qs = new URLSearchParams({
        empresaId,
        minScore: String(DRY_RUN_MIN_SCORE),
        tipo,
      })
      const res = await fetch(`/api/conciliacao/bulk-dry-run?${qs}`, {
        credentials: 'include',
        signal: controller.signal,
      })
      if (res.ok) {
        const data = await res.json()
        if (dryRunAbortRef.current === controller) {
          setDryRunPairs(data.pairs as DryRunPair[])
        }
      }
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        throw err
      }
    } finally {
      if (dryRunAbortRef.current === controller) {
        setDryRunLoading(false)
      }
    }
  }, [empresaId, tipo])

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
    if (tipo !== 'todos') sp.set('tipo', tipo) // 'todos' é default na maioria — omite pra URL limpa
    router.replace(`?${sp}`, { scroll: false })
  }, [empresaId, tipo, router])

  // Sprint A-effected Fase B — Map ofxId → suggestion top pra consolidar
  // tudo na aba "Conciliar". RowActions decide CASAR/CRIAR conforme suggestion
  // existe ou não. Cor do botão CASAR indica confiança (≥90 verde, 70-89 amarelo).
  const suggestionByOfxId = useMemo(() => {
    const m = new Map<string, MatchSuggestion>()
    for (const p of dryRunPairs) {
      m.set(p.ofx.id, {
        candidateId: p.candidate.id,
        score: p.score,
        reasoning: p.reasoning,
        candidate: p.candidate,
      })
    }
    return m
  }, [dryRunPairs])

  // Filtragem local — sem refetch, sem perda de scroll. Busca em descrição,
  // valor (formatado), nome da conta e nome do banco.
  const ofxTxsFiltradas = useMemo(() => {
    const term = busca.trim().toLowerCase()
    if (!term) return ofxTxs
    return ofxTxs.filter((t) => {
      if (t.description.toLowerCase().includes(term)) return true
      const valorStr = formatBRL(Math.abs(t.amount)).toLowerCase()
      if (valorStr.includes(term)) return true
      if ((t.bankAccount?.name ?? '').toLowerCase().includes(term)) return true
      if ((t.bankAccount?.bankName ?? '').toLowerCase().includes(term)) return true
      return false
    })
  }, [ofxTxs, busca])

  const altaCount = useMemo(
    () => dryRunPairs.filter((p) => p.score >= HIGH_CONFIDENCE_THRESHOLD).length,
    [dryRunPairs],
  )
  const altaTotal = useMemo(
    () =>
      dryRunPairs
        .filter((p) => p.score >= HIGH_CONFIDENCE_THRESHOLD)
        .reduce((acc, p) => acc + Math.abs(p.ofx.amount), 0),
    [dryRunPairs],
  )

  function refresh() {
    void fetchOfxTxs()
    void fetchDryRun()
    setRefreshKey((k) => k + 1) // dispara refetch do BalanceBanner
  }

  // Sprint UX-scroll-jump: remoção otimista sem refetch da lista inteira.
  // Antes: refresh() → setLoadingOfx(true) → TabsContent renderiza Card de
  // loading no lugar da lista → unmount → scroll volta pro topo.
  // Agora: remove só o item conciliado/ignorado do array local + dispara
  // refresh do balance (header). Lista nunca desmonta, scroll preservado.
  const removeOfxOptimistic = useCallback((ofxId: string) => {
    setOfxTxs((prev) => prev.filter((t) => t.id !== ofxId))
    setDryRunPairs((prev) => prev.filter((p) => p.ofx.id !== ofxId))
    setRefreshKey((k) => k + 1) // BalanceBanner refetcha saldos (não mexe na lista)
  }, [])

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

      {empresaId && (
        <StatementBalanceHeader empresaId={empresaId} refreshKey={refreshKey} />
      )}

      {empresaId && (
        <Tabs defaultValue="reconcile" className="space-y-4">
          {/* Sprint Conciliação-Visual: abas reduzidas a 2 (Cash coding +
              Bank statements removidas — modal "aprender e aplicar" e link
              "Importações OFX →" cobrem). */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TabsList className="grid w-auto grid-cols-2 min-w-[320px]">
              <TabsTrigger value="reconcile">
                A conciliar ({loadingOfx ? '…' : ofxTxs.length})
              </TabsTrigger>
              <TabsTrigger value="account-transactions">
                Já conciliadas
              </TabsTrigger>
            </TabsList>
            <Link href={`/empresas/${empresaId}/imports`}>
              <Button variant="ghost" size="sm" className="text-xs gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Importações OFX
              </Button>
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <TipoSelector value={tipo} onChange={setTipoUser} />
            <div className="flex items-center gap-2">
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
            {/* Busca local — preserva scroll do update otimista (sem refetch) */}
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, valor, banco..."
              className="flex-1 min-w-[200px] max-w-md h-9 px-3 text-sm rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* RECONCILE — statement lines com 4 ações por linha (Xero style) */}
          <TabsContent value="reconcile" className="space-y-4">
            {loadingOfx || dryRunLoading ? (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  <Sparkles className="h-6 w-6 mx-auto mb-2 animate-pulse" />
                  Loading statement lines and matching...
                </CardContent>
              </Card>
            ) : ofxTxs.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-emerald-600" />
                  Tudo conciliado. Saldo do extrato e saldo no sistema estão em sincronia ✓
                </CardContent>
              </Card>
            ) : ofxTxsFiltradas.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  Nenhuma transação bate o filtro &quot;{busca}&quot;.
                </CardContent>
              </Card>
            ) : (
              <div className="border rounded-lg bg-card divide-y">
                {ofxTxsFiltradas.map((t) => (
                  <div key={t.id} className="px-3">
                    <XeroRow
                      ofx={t}
                      empresaId={empresaId}
                      suggestion={suggestionByOfxId.get(t.id) ?? null}
                      onAction={() => removeOfxOptimistic(t.id)}
                    />
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* JÁ CONCILIADAS — histórico + Desfazer */}
          <TabsContent value="account-transactions" className="space-y-4">
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
