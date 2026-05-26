'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import {
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeftRight,
  Check,
  X,
  Loader2,
  Search,
  Filter,
  PartyPopper,
  Sparkles,
  Wand2,
} from 'lucide-react'
import { VincularTransferenciaModal } from '@/components/pendentes/VincularTransferenciaModal'
import { AprenderEAplicarModal } from '@/components/pendentes/AprenderEAplicarModal'
import {
  VendorSuggestionBanner,
  type VendorSuggestion,
} from '@/components/pendentes/VendorSuggestionBanner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Header } from '@/components/layout/header'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'

interface Categoria {
  id: string
  name: string
  // INCOME | EXPENSE | TRANSFER
  type: string
  color: string
}

interface Transacao {
  id: string
  description: string
  amount: number
  type: 'CREDIT' | 'DEBIT'
  date: string
  bankAccount: {
    id: string
    name: string
    bankName: string | null
  }
  // Fase 3 Etapa 2: supplier detectado (Camada 2A keyword / 2B BrasilAPI)
  supplier?: {
    id: string
    razaoSocial: string
    nomeFantasia: string | null
    fonte: string
    category: { id: string; name: string } | null
  } | null
}

interface Props {
  empresaId: string
  empresaNome: string
  categorias: Categoria[]
  // Fase 3 Etapas 1+2+3: stats injetadas pelo server pra header
  stats?: {
    autoClassificadasHoje: number
    regrasAtivas: number
    fornecedoresDetectados: number
    // Fase 3 Etapa 3
    iaSugestoesHoje: number
    iaCustoCentavosHoje: number // soma de costCents do AiUsageLog do dia
    claudeEnabled: boolean
  }
}

// Fase 3 Etapa 3 — sugestão Claude carregada lazy por linha
interface ClaudeHint {
  categoryId: string | null
  confidence: number
  reasoning: string
  alternativeCategoryIds: string[]
  cacheKey: string
  fromCache: boolean
  costCents: number
}

export function PendentesClient({
  empresaId,
  empresaNome,
  categorias,
  stats,
}: Props) {
  const { toast } = useToast()

  const [transacoes, setTransacoes] = useState<Transacao[]>([])
  const [loading, setLoading] = useState(true)

  // Estado de seleção de categoria por linha (id da transação → id da categoria escolhida)
  const [selecaoPorLinha, setSelecaoPorLinha] = useState<Record<string, string>>({})
  // Linhas com operação em andamento (salvar/ignorar)
  const [operandoIds, setOperandoIds] = useState<Set<string>>(new Set())
  // Transação selecionada pra modal "Vincular como transferência" (Sprint 1.7)
  const [vincularBase, setVincularBase] = useState<Transacao | null>(null)
  // Fase 3 Etapa 1: transação + categoria pra modal "Aprender e aplicar"
  const [aprenderState, setAprenderState] = useState<
    { tx: Transacao; categoria: Categoria } | null
  >(null)
  // Fase 3 Etapa 3: sugestões Claude carregadas lazy por linha
  const [claudeHints, setClaudeHints] = useState<Record<string, ClaudeHint>>({})
  const [solicitandoIa, setSolicitandoIa] = useState<Set<string>>(new Set())
  // Sprint 3.0.1 — banner persistente de falhas (Safari ITP cookie bug)
  const [falhasIgnorar, setFalhasIgnorar] = useState<
    Array<{ id: string; description: string; razao: string }>
  >([])
  // Sprint 5.0.2.l — estado do botão "Auto-categorizar tudo"
  const [autoCatLoading, setAutoCatLoading] = useState(false)
  const [autoCatResult, setAutoCatResult] = useState<{
    analisadas: number
    totalCategorizadas: number
    setor: string | null
    breakdown: {
      fase0_sameCompany: number
      fase1_pix: number
      fase2_rules: number
      fase3_setorPattern: number
    }
  } | null>(null)
  // Sprint 5.0.2.n — Vendor Discovery batch
  const [vendorDiscoveryLoading, setVendorDiscoveryLoading] = useState(false)
  const [vendorDiscoveryStats, setVendorDiscoveryStats] = useState<{
    total: number
    found: number
    breakdown: {
      cache: number
      brasilapi: number
      keyword: number
      claude: number
      none: number
    }
    totalCostUsd: number
  } | null>(null)
  const [vendorSuggestions, setVendorSuggestions] = useState<
    Record<string, VendorSuggestion>
  >({})

  // Filtros
  const noventaDiasAtras = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 90)
    return d.toISOString().split('T')[0]
  }, [])
  const hoje = useMemo(() => new Date().toISOString().split('T')[0], [])
  const [inicio, setInicio] = useState(noventaDiasAtras)
  const [fim, setFim] = useState(hoje)
  const [tipo, setTipo] = useState<'TODOS' | 'CREDIT' | 'DEBIT'>('TODOS')
  const [busca, setBusca] = useState('')

  const fetchTransacoes = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({
        empresaId,
        semCategoria: 'true',
        limit: '500',
      })
      if (inicio) qs.set('inicio', inicio)
      if (fim) qs.set('fim', fim)
      if (tipo !== 'TODOS') qs.set('tipo', tipo)
      // Excluir transações já marcadas como ignoradas
      // O endpoint aceita um único `status`, então buscamos só PENDING (default das importadas)
      qs.set('status', 'PENDING')

      const res = await fetch(`/api/transacoes?${qs}`)
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar transações.' })
        return
      }
      const data = await res.json()
      const txs: Transacao[] = data.transacoes ?? []
      setTransacoes(txs)
      // Fase 3 Etapa 2: pre-fill do dropdown quando supplier tem categoria sugerida
      setSelecaoPorLinha((prev) => {
        const next = { ...prev }
        for (const t of txs) {
          if (!next[t.id] && t.supplier?.category) {
            next[t.id] = t.supplier.category.id
          }
        }
        return next
      })
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha de rede ao carregar transações.' })
    } finally {
      setLoading(false)
    }
  }, [empresaId, inicio, fim, tipo, toast])

  useEffect(() => { fetchTransacoes() }, [fetchTransacoes])

  // Sprint 5.0.2.n — Vendor Discovery batch (sugere; não auto-aplica)
  async function sugerirIaParaPendentes() {
    if (vendorDiscoveryLoading) return
    setVendorDiscoveryLoading(true)
    setVendorDiscoveryStats(null)
    try {
      const res = await fetch(
        `/api/empresas/${empresaId}/vendor-discovery/batch`,
        { method: 'POST', credentials: 'include' },
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast({
          variant: 'destructive',
          title: 'Falha no Vendor Discovery',
          description: data.erro ?? `HTTP ${res.status}`,
        })
        return
      }
      const data = await res.json()
      setVendorDiscoveryStats({
        total: data.total,
        found: data.found,
        breakdown: data.breakdown,
        totalCostUsd: data.totalCostUsd,
      })
      // Mapeia sugestões por transactionId
      const map: Record<string, VendorSuggestion> = {}
      for (const s of data.suggestions ?? []) {
        if (!s.result?.cacheId) continue
        map[s.transactionId] = {
          transactionId: s.transactionId,
          cacheId: s.result.cacheId,
          logId: s.logId,
          source: s.result.source,
          vendorName: s.result.vendorName,
          razaoSocial: s.result.razaoSocial,
          cnpj: s.result.cnpj,
          cnaeDescricao: s.result.cnaeDescricao,
          categoriaSugerida: s.result.categoriaSugerida,
          confidence: s.result.confidence,
          description: s.result.description,
          matchedKeyword: s.result.matchedKeyword,
        }
      }
      setVendorSuggestions(map)
      const kwPart = data.breakdown.keyword
        ? ` · Palavra-chave: ${data.breakdown.keyword}`
        : ''
      toast({
        title: `${data.found} sugestões em ${data.total} pendentes`,
        description: `Cache: ${data.breakdown.cache} · BrasilAPI: ${data.breakdown.brasilapi}${kwPart} · IA: ${data.breakdown.claude} · Custo: $${data.totalCostUsd.toFixed(4)}`,
        duration: 6000,
      })
    } catch {
      toast({ variant: 'destructive', title: 'Erro de rede' })
    } finally {
      setVendorDiscoveryLoading(false)
    }
  }

  function dismissSuggestion(txId: string) {
    setVendorSuggestions((prev) => {
      const next = { ...prev }
      delete next[txId]
      return next
    })
  }

  // Sprint 5.0.2.o — Limpar cache envenenado + re-rodar discovery
  async function limparCacheEReanalizar() {
    if (vendorDiscoveryLoading) return
    setVendorDiscoveryLoading(true)
    setVendorDiscoveryStats(null)
    try {
      const cleanRes = await fetch(
        '/api/admin/vendor-discovery/clean-poisoned-cache',
        { method: 'POST', credentials: 'include' },
      )
      const cleanData = await cleanRes.json().catch(() => ({}))
      if (!cleanRes.ok) {
        toast({
          variant: 'destructive',
          title: 'Falha ao limpar cache',
          description: cleanData.erro ?? `HTTP ${cleanRes.status}`,
        })
        return
      }
      const redoRes = await fetch(
        `/api/empresas/${empresaId}/vendor-discovery/redo-rejected`,
        { method: 'POST', credentials: 'include' },
      )
      if (!redoRes.ok) {
        const data = await redoRes.json().catch(() => ({}))
        toast({
          variant: 'destructive',
          title: 'Falha ao re-analisar',
          description: data.erro ?? `HTTP ${redoRes.status}`,
        })
        return
      }
      const data = await redoRes.json()
      setVendorDiscoveryStats({
        total: data.total,
        found: data.found,
        breakdown: data.breakdown,
        totalCostUsd: data.totalCostUsd,
      })
      const map: Record<string, VendorSuggestion> = {}
      for (const s of data.suggestions ?? []) {
        if (!s.result?.cacheId) continue
        map[s.transactionId] = {
          transactionId: s.transactionId,
          cacheId: s.result.cacheId,
          logId: s.logId,
          source: s.result.source,
          vendorName: s.result.vendorName,
          razaoSocial: s.result.razaoSocial,
          cnpj: s.result.cnpj,
          cnaeDescricao: s.result.cnaeDescricao,
          categoriaSugerida: s.result.categoriaSugerida,
          confidence: s.result.confidence,
          description: s.result.description,
          matchedKeyword: s.result.matchedKeyword,
        }
      }
      setVendorSuggestions(map)
      toast({
        title: `🧹 ${cleanData.deleted} cache · ✨ ${data.found} sugestões`,
        description: `Cache: ${data.breakdown.cache} · BrasilAPI: ${data.breakdown.brasilapi} · Palavra-chave: ${data.breakdown.keyword} · IA: ${data.breakdown.claude}`,
        duration: 7000,
      })
    } catch {
      toast({ variant: 'destructive', title: 'Erro de rede' })
    } finally {
      setVendorDiscoveryLoading(false)
    }
  }

  // Sprint 5.0.2.l — Auto-categorizar TODAS as pendentes em bulk.
  // Pipeline 5 fases: same-company → pix → regras EXACT/CONTAINS → universal BR.
  async function autoCategorizarTudo() {
    if (autoCatLoading) return
    setAutoCatLoading(true)
    setAutoCatResult(null)
    try {
      const res = await fetch(`/api/empresas/${empresaId}/auto-categorize-all`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast({
          variant: 'destructive',
          title: 'Falha na auto-categorização',
          description: data.erro ?? `HTTP ${res.status}`,
        })
        return
      }
      const data = await res.json()
      setAutoCatResult({
        analisadas: data.analisadas,
        totalCategorizadas: data.totalCategorizadas,
        setor: data.setor ?? null,
        breakdown: data.breakdown,
      })
      toast({
        title: `${data.totalCategorizadas} de ${data.analisadas} categorizadas`,
        description: `Mesma empresa: ${data.breakdown.fase0_sameCompany} · Pix: ${data.breakdown.fase1_pix} · Regras: ${data.breakdown.fase2_rules} · KB ${data.setor ?? 'UNIVERSAL'}: ${data.breakdown.fase3_setorPattern}`,
      })
      await fetchTransacoes()
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro de rede',
        description: 'Falha ao auto-categorizar. Tente novamente.',
      })
    } finally {
      setAutoCatLoading(false)
    }
  }

  // Fase 3 Etapa 3: pede sugestão Claude pra UMA transação (lazy load).
  async function pedirSugestaoIA(t: Transacao) {
    if (claudeHints[t.id]) return // já tem
    setSolicitandoIa((prev) => new Set(prev).add(t.id))
    try {
      const res = await fetch(`/api/ai-categorizer/claude-suggest/${t.id}`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) {
        toast({
          variant: 'destructive',
          title: data.erro ?? 'Falha ao consultar IA',
          description:
            data.detalhe ??
            (res.status === 429
              ? 'Limite de uso atingido. Tente em breve.'
              : 'Tente novamente em alguns segundos.'),
        })
        return
      }
      const hint: ClaudeHint = {
        categoryId: data.suggestion.categoryId,
        confidence: data.suggestion.confidence,
        reasoning: data.suggestion.reasoning,
        alternativeCategoryIds: data.suggestion.alternativeCategoryIds ?? [],
        cacheKey: data.cacheKey,
        fromCache: !!data.fromCache,
        costCents: data.costCents ?? 0,
      }
      setClaudeHints((prev) => ({ ...prev, [t.id]: hint }))
      // Pre-fill dropdown com sugestão (se categoryId válido)
      if (hint.categoryId) {
        setSelecaoPorLinha((prev) => ({ ...prev, [t.id]: hint.categoryId! }))
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro de rede',
        description: 'Não foi possível consultar a IA. Tente novamente.',
      })
    } finally {
      setSolicitandoIa((prev) => {
        const next = new Set(prev)
        next.delete(t.id)
        return next
      })
    }
  }

  // Categorias compatíveis com o tipo da transação:
  // CREDIT (entrada) → INCOME ou TRANSFER
  // DEBIT (saída) → EXPENSE ou TRANSFER
  function categoriasParaTransacao(tipoTx: 'CREDIT' | 'DEBIT'): Categoria[] {
    if (tipoTx === 'CREDIT') return categorias.filter((c) => c.type === 'INCOME' || c.type === 'TRANSFER')
    return categorias.filter((c) => c.type === 'EXPENSE' || c.type === 'TRANSFER')
  }

  // Filtro client-side por busca (descrição). Período/tipo já vêm filtrados do servidor.
  const transacoesFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return transacoes
    return transacoes.filter((t) => t.description.toLowerCase().includes(q))
  }, [transacoes, busca])

  function marcarOperando(id: string, on: boolean) {
    setOperandoIds((prev) => {
      const next = new Set(prev)
      if (on) next.add(id); else next.delete(id)
      return next
    })
  }

  // Fase 3 Etapa 1: ao clicar ✓, em vez de PUT direto, abre modal de
  // "Aprender e aplicar" que checa transações similares + permite criar regra.
  function salvarCategoria(transacaoId: string) {
    const categoriaId = selecaoPorLinha[transacaoId]
    if (!categoriaId) return
    const tx = transacoes.find((t) => t.id === transacaoId)
    const categoria = categorias.find((c) => c.id === categoriaId)
    if (!tx || !categoria) return
    setAprenderState({ tx, categoria })
  }

  async function ignorarTransacao(transacaoId: string) {
    marcarOperando(transacaoId, true)
    const tx = transacoes.find((t) => t.id === transacaoId)
    const descricaoCurta = tx?.description?.slice(0, 50) ?? transacaoId
    try {
      // Sprint 3.0.1 — credentials:'include' contorna Safari ITP que pode
      // suprimir cookies em PUT após inatividade.
      const res = await fetch(`/api/transacoes/${transacaoId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'IGNORED' }),
      })

      // Sprint 3.0.1 — Detecção de sessão expirada (401 JSON do proxy.ts novo).
      if (res.status === 401) {
        const data = await res.json().catch(() => ({}))
        toast({
          variant: 'destructive',
          title: 'Sessão expirada',
          description: 'Faça login de novo pra continuar.',
        })
        setFalhasIgnorar((prev) => [
          ...prev.filter((f) => f.id !== transacaoId),
          { id: transacaoId, description: descricaoCurta, razao: data.erro ?? 'Sessão expirada' },
        ])
        return
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const razao = data.erro ?? `HTTP ${res.status}`
        toast({ variant: 'destructive', title: 'Erro ao ignorar', description: razao })
        setFalhasIgnorar((prev) => [
          ...prev.filter((f) => f.id !== transacaoId),
          { id: transacaoId, description: descricaoCurta, razao },
        ])
        return
      }

      // Sprint 3.0.1 — Confirmação DB anti-otimismo.
      // Re-fetch da tx pra garantir que o status REALMENTE virou IGNORED no banco.
      try {
        const verifyRes = await fetch(`/api/transacoes/${transacaoId}`, {
          credentials: 'include',
        })
        if (verifyRes.ok) {
          const verifyData = await verifyRes.json()
          const statusReal = verifyData?.transacao?.status ?? verifyData?.status
          if (statusReal && statusReal !== 'IGNORED') {
            // PUT pareceu OK mas status não mudou — bug silencioso.
            setFalhasIgnorar((prev) => [
              ...prev.filter((f) => f.id !== transacaoId),
              {
                id: transacaoId,
                description: descricaoCurta,
                razao: `PUT OK mas status=${statusReal} no banco`,
              },
            ])
            toast({
              variant: 'destructive',
              title: 'Inconsistência detectada',
              description: 'Servidor reportou sucesso mas status não atualizou.',
            })
            return
          }
        }
      } catch {
        // Verify falhou — segue assumindo OK (PUT já retornou 2xx).
      }

      // Sucesso confirmado: remove do array local + clean state
      setTransacoes((prev) => prev.filter((t) => t.id !== transacaoId))
      setSelecaoPorLinha((prev) => {
        const next = { ...prev }
        delete next[transacaoId]
        return next
      })
      setFalhasIgnorar((prev) => prev.filter((f) => f.id !== transacaoId))
      toast({ title: 'Transação ignorada', description: 'Removida da fila de pendentes.' })
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha de rede ao ignorar.' })
      setFalhasIgnorar((prev) => [
        ...prev.filter((f) => f.id !== transacaoId),
        { id: transacaoId, description: descricaoCurta, razao: 'Falha de rede' },
      ])
    } finally {
      marcarOperando(transacaoId, false)
    }
  }

  // Sprint 3.0.1 — Tentar de novo todas as falhas
  async function retryFalhas() {
    const ids = falhasIgnorar.map((f) => f.id)
    setFalhasIgnorar([])
    for (const id of ids) {
      await ignorarTransacao(id)
    }
  }

  return (
    <div className="space-y-6">
      <Header
        title="Pendentes de Classificação"
        description={`${transacoesFiltradas.length} transação${transacoesFiltradas.length !== 1 ? 'ões' : ''} em ${empresaNome}`}
      >
        <Button
          onClick={() => void sugerirIaParaPendentes()}
          disabled={vendorDiscoveryLoading || transacoes.length === 0}
          variant="outline"
          className="gap-2"
        >
          {vendorDiscoveryLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {vendorDiscoveryLoading ? 'Pesquisando IA...' : 'Sugerir IA'}
        </Button>
        <Button
          onClick={() => void limparCacheEReanalizar()}
          disabled={vendorDiscoveryLoading || transacoes.length === 0}
          variant="outline"
          className="gap-2"
          title="Remove sugestões ruins do cache global e re-analisa pendentes"
        >
          🧹 Limpar + Re-analisar
        </Button>
        <Button
          onClick={() => void autoCategorizarTudo()}
          disabled={autoCatLoading || transacoes.length === 0}
          variant="default"
          className="gap-2"
        >
          {autoCatLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Wand2 className="h-4 w-4" />
          )}
          {autoCatLoading ? 'Categorizando...' : 'Auto-categorizar tudo'}
        </Button>
      </Header>

      {/* Sprint 5.0.2.n — resultado do Vendor Discovery batch */}
      {vendorDiscoveryStats && (
        <div className="rounded-md border border-purple-500/30 bg-purple-500/5 px-4 py-3">
          <p className="text-sm font-semibold">
            ✨ {vendorDiscoveryStats.found} sugestões em {vendorDiscoveryStats.total} pendentes
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Cache global: <strong>{vendorDiscoveryStats.breakdown.cache}</strong> ·
            BrasilAPI: <strong>{vendorDiscoveryStats.breakdown.brasilapi}</strong> ·
            Palavra-chave: <strong>{vendorDiscoveryStats.breakdown.keyword}</strong> ·
            Claude IA: <strong>{vendorDiscoveryStats.breakdown.claude}</strong> ·
            Custo: <strong>${vendorDiscoveryStats.totalCostUsd.toFixed(4)}</strong>
          </p>
        </div>
      )}

      {/* Sprint 5.0.2.l — resultado do bulk auto-categorize */}
      {autoCatResult && (
        <div className="rounded-md border border-primary/30 bg-primary/5 px-4 py-3">
          <p className="text-sm font-semibold">
            ✨ {autoCatResult.totalCategorizadas} de {autoCatResult.analisadas} pendentes categorizadas automaticamente
            {autoCatResult.setor && (
              <span className="text-xs text-muted-foreground ml-2 font-normal">
                (KB: {autoCatResult.setor})
              </span>
            )}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Transferências internas: <strong>{autoCatResult.breakdown.fase0_sameCompany}</strong> ·
            Pix relacionado: <strong>{autoCatResult.breakdown.fase1_pix}</strong> ·
            Regras aprendidas: <strong>{autoCatResult.breakdown.fase2_rules}</strong> ·
            Padrões setoriais: <strong>{autoCatResult.breakdown.fase3_setorPattern}</strong>
          </p>
        </div>
      )}

      {/* Sprint 3.0.1 — banner persistente de falhas (Safari ITP) */}
      {falhasIgnorar.length > 0 && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-destructive">
                {falhasIgnorar.length} transaç{falhasIgnorar.length === 1 ? 'ão falhou' : 'ões falharam'} ao ignorar
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Pode ser sessão expirada (Safari). Tente novamente — se persistir, recarregue a página com Cmd+Shift+R.
              </p>
              <ul className="mt-2 space-y-0.5 text-xs">
                {falhasIgnorar.slice(0, 5).map((f) => (
                  <li key={f.id} className="truncate text-muted-foreground">
                    • <span className="font-mono">{f.description}</span>
                    {f.razao && <span className="ml-1 text-destructive">({f.razao})</span>}
                  </li>
                ))}
                {falhasIgnorar.length > 5 && (
                  <li className="text-muted-foreground">+ {falhasIgnorar.length - 5} mais</li>
                )}
              </ul>
            </div>
            <div className="flex flex-col gap-1.5 shrink-0">
              <button
                onClick={() => void retryFalhas()}
                className="text-xs font-medium px-3 py-1.5 rounded bg-destructive text-destructive-foreground hover:opacity-90"
              >
                Tentar todas
              </button>
              <button
                onClick={() => setFalhasIgnorar([])}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Limpar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fase 3 Etapas 1+2: stats da IA Contadora */}
      {stats &&
        (stats.autoClassificadasHoje > 0 ||
          stats.regrasAtivas > 0 ||
          stats.fornecedoresDetectados > 0) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md border bg-primary/5 border-primary/20 px-3 py-2 text-xs">
          {stats.autoClassificadasHoje > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="text-base leading-none">🤖</span>
              <strong className="tabular-nums">{stats.autoClassificadasHoje}</strong>
              <span className="text-muted-foreground">
                {stats.autoClassificadasHoje === 1
                  ? 'transação auto-classificada hoje'
                  : 'transações auto-classificadas hoje'}
              </span>
            </span>
          )}
          {stats.regrasAtivas > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="text-muted-foreground">·</span>
              <strong className="tabular-nums">{stats.regrasAtivas}</strong>
              <span className="text-muted-foreground">
                {stats.regrasAtivas === 1
                  ? 'regra aprendida'
                  : 'regras aprendidas'}
              </span>
            </span>
          )}
          {stats.fornecedoresDetectados > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="text-muted-foreground">·</span>
              <span className="text-base leading-none">💼</span>
              <strong className="tabular-nums">{stats.fornecedoresDetectados}</strong>
              <span className="text-muted-foreground">
                {stats.fornecedoresDetectados === 1
                  ? 'fornecedor detectado'
                  : 'fornecedores detectados'}
              </span>
            </span>
          )}
          {/* Fase 3 Etapa 3: stat sugestões IA */}
          {stats.iaSugestoesHoje > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="text-muted-foreground">·</span>
              <span className="text-base leading-none">💭</span>
              <strong className="tabular-nums">{stats.iaSugestoesHoje}</strong>
              <span className="text-muted-foreground">
                {stats.iaSugestoesHoje === 1
                  ? 'classificação IA hoje'
                  : 'classificações IA hoje'}
                {stats.iaCustoCentavosHoje > 0 && (
                  <>
                    {' '}(US${(stats.iaCustoCentavosHoje / 100).toFixed(2)})
                  </>
                )}
              </span>
            </span>
          )}
        </div>
      )}

      {/* Filtros */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-end gap-3">
            <Filter className="h-4 w-4 text-muted-foreground mt-auto mb-1 shrink-0" />

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">De</p>
              <Input type="date" className="h-8 w-36 text-sm" value={inicio} onChange={(e) => setInicio(e.target.value)} />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Até</p>
              <Input type="date" className="h-8 w-36 text-sm" value={fim} onChange={(e) => setFim(e.target.value)} />
            </div>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Tipo</p>
              <Select value={tipo} onValueChange={(v) => setTipo(v as typeof tipo)}>
                <SelectTrigger className="h-8 w-32 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos</SelectItem>
                  <SelectItem value="CREDIT">Entradas</SelectItem>
                  <SelectItem value="DEBIT">Saídas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1 flex-1 min-w-[200px]">
              <p className="text-xs text-muted-foreground">Buscar na descrição</p>
              <div className="relative">
                <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="h-8 pl-8 text-sm"
                  placeholder="Ex: PIX, STONE, ALUGUEL..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-16 rounded-lg border bg-muted animate-pulse" />)}
        </div>
      ) : transacoesFiltradas.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <PartyPopper className="h-12 w-12 text-green-500 mb-4" />
          <h3 className="font-semibold text-lg">
            {busca || tipo !== 'TODOS'
              ? 'Nenhuma transação corresponde aos filtros'
              : 'Nenhuma transação pendente nesta empresa'}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {busca || tipo !== 'TODOS'
              ? 'Tente alterar os filtros acima.'
              : 'Tudo classificado por aqui.'}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          {transacoesFiltradas.map((t, i) => {
            const cats = categoriasParaTransacao(t.type)
            const operando = operandoIds.has(t.id)
            const selecionada = selecaoPorLinha[t.id]
            const hint = claudeHints[t.id]
            const consultandoIa = solicitandoIa.has(t.id)
            // Só oferece IA quando Camadas 1+2 falharam (sem supplier).
            // E só se Claude está habilitado no server.
            const podeIa = !t.supplier && stats?.claudeEnabled === true && !hint

            return (
              <div
                key={t.id}
                className={`flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center ${i > 0 ? 'border-t' : ''}`}
              >
                {/* Ícone + descrição + meta */}
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className={`shrink-0 flex h-9 w-9 items-center justify-center rounded-full ${
                    t.type === 'CREDIT' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                  }`}>
                    {t.type === 'CREDIT' ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{t.description}</p>
                    {/* Fase 3 Etapa 2: badge fornecedor (Camada 2A keyword / 2B BrasilAPI) */}
                    {t.supplier && (
                      <span
                        className={`inline-flex items-center gap-1 mt-0.5 text-xs rounded px-1.5 py-0.5 border ${
                          t.supplier.fonte === 'BRASILAPI'
                            ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200'
                            : 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-200'
                        }`}
                        title={
                          t.supplier.fonte === 'BRASILAPI'
                            ? 'Detectado via consulta CNPJ na BrasilAPI'
                            : 'Detectado por palavra-chave (Conta IA)'
                        }
                      >
                        💼{' '}
                        {t.supplier.fonte === 'BRASILAPI'
                          ? 'BrasilAPI'
                          : 'Detectado'}
                        : <strong className="font-semibold">{t.supplier.razaoSocial}</strong>
                        {t.supplier.category && (
                          <span className="opacity-80">
                            → {t.supplier.category.name}
                          </span>
                        )}
                      </span>
                    )}
                    {/* Fase 3 Etapa 3: badge sugestão Claude (Camada 3) */}
                    {hint && (
                      <span
                        className="inline-flex items-center gap-1 mt-0.5 text-xs rounded px-1.5 py-0.5 border border-purple-300 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-200"
                        title={hint.reasoning}
                      >
                        💭 IA sugere:{' '}
                        <strong className="font-semibold">
                          {hint.categoryId
                            ? categorias.find((c) => c.id === hint.categoryId)?.name ?? 'Categoria removida'
                            : 'Classificar manualmente'}
                        </strong>
                        <span className="opacity-80">
                          ({Math.round(hint.confidence * 100)}%
                          {hint.fromCache ? ' · cache' : ''})
                        </span>
                      </span>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(t.date).toLocaleDateString('pt-BR')}
                      {' · '}
                      <span className={t.type === 'CREDIT' ? 'text-green-600' : 'text-red-600'}>
                        {t.type === 'CREDIT' ? '+' : '−'} {formatBRL(t.amount)}
                      </span>
                      {' · '}
                      {t.bankAccount.bankName ?? 'Banco?'} / {t.bankAccount.name}
                    </p>
                  </div>
                </div>

                {/* Select de categoria */}
                <div className="flex items-center gap-2 shrink-0">
                  <Select
                    value={selecionada ?? ''}
                    onValueChange={(v) => setSelecaoPorLinha((prev) => ({ ...prev, [t.id]: v }))}
                    disabled={operando}
                  >
                    <SelectTrigger className="h-8 w-56 text-sm">
                      <SelectValue placeholder="Escolher categoria..." />
                    </SelectTrigger>
                    <SelectContent>
                      {cats.length === 0 ? (
                        <div className="px-2 py-1.5 text-xs text-muted-foreground">
                          Nenhuma categoria {t.type === 'CREDIT' ? 'de entrada' : 'de saída'} cadastrada.
                        </div>
                      ) : (
                        cats.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            <div className="flex items-center gap-2">
                              <span
                                className="inline-block h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: c.color }}
                              />
                              {c.name}
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>

                  {/* Fase 3 Etapa 3: botão "💭 IA" — só pra tx sem cobertura
                      Camadas 1+2 + Claude habilitado. Lazy load 3-5s. */}
                  {podeIa && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => pedirSugestaoIA(t)}
                      disabled={operando || consultandoIa}
                      title="Pedir sugestão da IA Contadora (Claude)"
                      className="gap-1.5 border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-200 dark:hover:bg-purple-950"
                    >
                      {consultandoIa ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      <span className="hidden sm:inline text-xs">IA</span>
                    </Button>
                  )}

                  {/* Botão "✓" salvar — Enter no foco também aciona */}
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => salvarCategoria(t.id)}
                    disabled={operando || !selecionada}
                    title="Salvar categoria (Enter)"
                  >
                    {operando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  </Button>

                  {/* Botão "↔ É transferência" — Sprint 1.7. Pareia com tx em outra conta. */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setVincularBase(t)}
                    disabled={operando}
                    title="É parte de uma transferência entre suas contas"
                    className="gap-1.5"
                  >
                    <ArrowLeftRight className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline text-xs">É transferência</span>
                  </Button>

                  {/* Botão "Ignorar" */}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => ignorarTransacao(t.id)}
                    disabled={operando}
                    title="Ignorar transação"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {/* Sprint 5.0.2.n — Banner Sugerido por IA (Vendor Discovery) */}
                {vendorSuggestions[t.id] && (
                  <div className="sm:col-span-full sm:basis-full">
                    <VendorSuggestionBanner
                      empresaId={empresaId}
                      suggestion={vendorSuggestions[t.id]}
                      onAccepted={() => {
                        dismissSuggestion(t.id)
                        void fetchTransacoes()
                      }}
                      onRejected={() => dismissSuggestion(t.id)}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <VincularTransferenciaModal
        open={!!vincularBase}
        onOpenChange={(o) => !o && setVincularBase(null)}
        base={
          vincularBase
            ? {
                id: vincularBase.id,
                description: vincularBase.description,
                amount: vincularBase.amount,
                type: vincularBase.type,
                date: vincularBase.date,
                bankAccount: vincularBase.bankAccount,
              }
            : null
        }
        onSuccess={({ idA, idB }) => {
          // Ambas as transações foram apagadas e viraram par TRANSFER —
          // remove as 2 da lista local otimisticamente
          setTransacoes((prev) => prev.filter((t) => t.id !== idA && t.id !== idB))
          setVincularBase(null)
        }}
      />

      <AprenderEAplicarModal
        open={!!aprenderState}
        onOpenChange={(o) => !o && setAprenderState(null)}
        base={
          aprenderState
            ? {
                id: aprenderState.tx.id,
                description: aprenderState.tx.description,
              }
            : null
        }
        categoria={
          aprenderState
            ? { id: aprenderState.categoria.id, name: aprenderState.categoria.name }
            : null
        }
        claudeContext={
          aprenderState && claudeHints[aprenderState.tx.id]
            ? {
                cacheKey: claudeHints[aprenderState.tx.id].cacheKey,
                suggestedCategoryId:
                  claudeHints[aprenderState.tx.id].categoryId,
              }
            : null
        }
        onApplied={({ affectedTxIds }) => {
          // Remove tudo que foi classificado da lista local (base + similares
          // do preview). O DB tem mais (até todas as similares); o user vê
          // o preview removido imediatamente. Refetch pra puxar o resto.
          setTransacoes((prev) =>
            prev.filter((t) => !affectedTxIds.includes(t.id)),
          )
          setSelecaoPorLinha((prev) => {
            const next = { ...prev }
            affectedTxIds.forEach((id) => delete next[id])
            return next
          })
          // Fase 3 Etapa 3: limpa hint Claude (já foi aplicado/dispensado)
          setClaudeHints((prev) => {
            const next = { ...prev }
            affectedTxIds.forEach((id) => delete next[id])
            return next
          })
          // Refetch async — pega as similares que não estavam no preview
          fetchTransacoes()
        }}
      />
    </div>
  )
}
