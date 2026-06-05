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
          <TabsList className="grid w-full max-w-2xl grid-cols-4">
            <TabsTrigger value="reconcile">
              Reconcile ({loadingOfx ? '…' : ofxTxs.length})
            </TabsTrigger>
            <TabsTrigger value="cash-coding">
              Cash coding
            </TabsTrigger>
            <TabsTrigger value="bank-statements">
              Bank statements
            </TabsTrigger>
            <TabsTrigger value="account-transactions">
              Account transactions
            </TabsTrigger>
          </TabsList>

          <div className="flex flex-wrap items-center gap-4">
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
                  All caught up. Statement balance and Balance in Xero are in sync ✓
                </CardContent>
              </Card>
            ) : (
              <div className="border rounded-lg bg-card divide-y">
                {ofxTxs.map((t) => (
                  <div key={t.id} className="px-3">
                    <XeroRow
                      ofx={t}
                      empresaId={empresaId}
                      suggestion={suggestionByOfxId.get(t.id) ?? null}
                      onAction={refresh}
                    />
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* CASH CODING — placeholder Fase C */}
          <TabsContent value="cash-coding" className="space-y-4">
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                <Sparkles className="h-6 w-6 mx-auto mb-2 text-amber-600" />
                <p className="font-medium mb-1">Cash coding — em breve (Fase C)</p>
                <p className="text-xs max-w-md mx-auto">
                  Grid de 100-200 linhas pra categorizar muitas vendas PIX/maquininha
                  de uma vez. Ordena, seleciona em lote, aplica categoria + regra.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* BANK STATEMENTS — placeholder com link pra import */}
          <TabsContent value="bank-statements" className="space-y-4">
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                <FileText className="h-6 w-6 mx-auto mb-2 text-blue-600" />
                <p className="font-medium mb-1">Bank statements</p>
                <p className="text-xs max-w-md mx-auto mb-3">
                  Importações OFX recentes desta conta. Ver histórico, reverter, e
                  importar novo extrato.
                </p>
                {empresaId && (
                  <Link href={`/empresas/${empresaId}/imports`}>
                    <Button variant="outline" size="sm">
                      Ver imports OFX →
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ACCOUNT TRANSACTIONS — histórico de conciliadas (Xero name) */}
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
