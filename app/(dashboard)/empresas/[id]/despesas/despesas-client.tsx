'use client'

// Sprint 6 — Página Despesas (drill-down do Top 5).
//
// FONTE ÚNICA: dados vêm do server component (getExpenseBreakdown). Aqui
// só toggle/filtros + expansão de categoria + fetch de transações sob
// demanda. Total exibido bate com despesaOperacional do dashboard.

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ChevronDown,
  ChevronRight,
  Download,
  Search,
  Wallet,
  Info,
  AlertTriangle,
  Loader2,
  ArrowLeft,
  Tag,
  Undo2,
  X,
  Sparkles,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'
import type {
  ExpenseBreakdownResult,
  ExpenseTransactionItem,
} from '@/lib/dashboard/expenses-breakdown'
import type { Regime } from '@/lib/dashboard/engine'
import { CategoryPicker, type CategoriaPickerItem } from './category-picker'
import { applyOptimisticMove } from './optimistic-move'

interface Conta {
  id: string
  name: string
}

interface DespesasClientProps {
  empresaId: string
  empresaNome: string
  breakdown: ExpenseBreakdownResult
  contas: Conta[]
  categorias: CategoriaPickerItem[]
  regime: Regime
  periodStart: string // yyyy-mm-dd
  periodEnd: string
  initialExpandedCategoryId: string | null
  initialContaId: string | null
  initialQuery: string
}

// Sprint 10 — info da última recategorização (pra Undo + oferta de regra)
interface LastRecat {
  previousByTxId: Record<string, string | null>
  novaCategoria: { id: string; name: string }
  affectedIds: string[]
  /** Descrição da primeira tx — usada como base pra sugerir regra "CONTAINS". */
  sampleDescription?: string
}

const DRE_GROUP_LABEL: Record<string, string> = {
  CUSTO_PRODUTO_VENDIDO: 'Custo',
  DESPESAS_PESSOAL: 'Pessoal',
  DESPESAS_COMERCIAIS: 'Comercial',
  DESPESAS_ADMINISTRATIVAS: 'Administrativo',
  DESPESAS_FINANCEIRAS: 'Financeiro',
  OUTRAS_DESPESAS: 'Outras',
  IMPOSTOS_SOBRE_LUCRO: 'Impostos',
}

const DRE_GROUP_COLOR: Record<string, string> = {
  CUSTO_PRODUTO_VENDIDO: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
  DESPESAS_PESSOAL: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  DESPESAS_COMERCIAIS: 'bg-purple-500/15 text-purple-700 dark:text-purple-300',
  DESPESAS_ADMINISTRATIVAS: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
  DESPESAS_FINANCEIRAS: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  OUTRAS_DESPESAS: 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-300',
  IMPOSTOS_SOBRE_LUCRO: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
}

export function DespesasClient(props: DespesasClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [expanded, setExpanded] = useState<Set<string>>(
    new Set(props.initialExpandedCategoryId ? [props.initialExpandedCategoryId] : []),
  )
  // Sprint 11 — breakdown vira estado local pra updates otimistas (recategorizar
  // não dispara router.refresh, não causa reset de scroll/expansão).
  const [breakdown, setBreakdown] = useState<ExpenseBreakdownResult>(props.breakdown)
  // Quando o prop muda (filtros / período / regime via URL), reseta o estado
  useEffect(() => {
    setBreakdown(props.breakdown)
  }, [props.breakdown])
  const [txCache, setTxCache] = useState<Record<string, { items: ExpenseTransactionItem[]; total: number; loading?: boolean }>>({})
  const [query, setQuery] = useState(props.initialQuery)
  const [contaFilter, setContaFilter] = useState<string>(props.initialContaId ?? 'all')
  const [orderBy, setOrderBy] = useState<'gasto' | 'nome'>('gasto')

  const [isPending, startTransition] = useTransition()

  // Sprint 10 — seleção em lote (cross-category) + picker compartilhado
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [pickerOpenFor, setPickerOpenFor] = useState<{
    txIds: string[]
    anchorRect: DOMRect | null
  } | null>(null)
  const [recategorizing, setRecategorizing] = useState(false)
  const [lastRecat, setLastRecat] = useState<LastRecat | null>(null)
  /** Map auxiliar: id → tx (pra calcular valor selecionado + descrição base) */
  const txById = useMemo(() => {
    const m = new Map<string, ExpenseTransactionItem>()
    for (const entry of Object.values(txCache)) {
      for (const t of entry.items) m.set(t.id, t)
    }
    return m
  }, [txCache])
  const selectedAmount = useMemo(() => {
    let total = 0
    for (const id of selectedIds) {
      const t = txById.get(id)
      if (t) total += t.amount
    }
    return total
  }, [selectedIds, txById])

  // Categorias ordenadas
  const categoriasOrdenadas = useMemo(() => {
    const arr = [...breakdown.categorias]
    if (orderBy === 'nome') arr.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    else arr.sort((a, b) => b.total - a.total)
    return arr
  }, [breakdown.categorias, orderBy])

  // Aplica filtros via URL (server refaz breakdown)
  function updateUrl(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === '') params.delete(k)
      else params.set(k, v)
    }
    startTransition(() => {
      router.replace(`?${params.toString()}`, { scroll: false })
    })
  }

  function toggleCategory(categoryId: string) {
    const next = new Set(expanded)
    if (next.has(categoryId)) {
      next.delete(categoryId)
    } else {
      next.add(categoryId)
      // Carrega tx se ainda não carregadas
      if (!txCache[categoryId]) {
        loadTx(categoryId)
      }
    }
    setExpanded(next)
  }

  async function loadTx(categoryId: string) {
    setTxCache((prev) => ({ ...prev, [categoryId]: { items: [], total: 0, loading: true } }))
    try {
      const params = new URLSearchParams({
        regime: props.regime,
        de: props.periodStart,
        ate: props.periodEnd,
        categoryId,
        limit: '100',
      })
      if (contaFilter && contaFilter !== 'all') params.set('contaId', contaFilter)
      if (query.trim()) params.set('q', query.trim())
      const res = await fetch(`/api/empresas/${props.empresaId}/despesas/transacoes?${params.toString()}`)
      const data = await res.json()
      setTxCache((prev) => ({
        ...prev,
        [categoryId]: { items: data.items ?? [], total: data.total ?? 0, loading: false },
      }))
    } catch {
      setTxCache((prev) => ({ ...prev, [categoryId]: { items: [], total: 0, loading: false } }))
    }
  }

  // Recarrega tx das categorias expandidas quando query/conta muda
  useEffect(() => {
    expanded.forEach((catId) => loadTx(catId))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, contaFilter])

  // Sprint 10 — handlers de seleção + recategorização
  const toggleSelect = useCallback((txId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(txId)) next.delete(txId)
      else next.add(txId)
      return next
    })
  }, [])

  const selectAllInCategory = useCallback((categoryId: string, items: ExpenseTransactionItem[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      const allSelected = items.every((t) => next.has(t.id))
      if (allSelected) for (const t of items) next.delete(t.id)
      else for (const t of items) next.add(t.id)
      return next
    })
  }, [])

  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])

  const openPickerFor = useCallback((txIds: string[], anchorRect: DOMRect | null) => {
    if (txIds.length === 0) return
    setPickerOpenFor({ txIds, anchorRect })
  }, [])

  const recategorize = useCallback(
    async (txIds: string[], novaCategoriaId: string) => {
      if (txIds.length === 0) return
      setRecategorizing(true)
      try {
        const res = await fetch(
          `/api/empresas/${props.empresaId}/despesas/recategorizar`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transactionIds: txIds, novaCategoriaId }),
            credentials: 'include',
          },
        )
        const data = await res.json()
        if (!res.ok) {
          toast({
            variant: 'destructive',
            title: 'Erro',
            description: data.erro ?? 'Falha ao recategorizar.',
          })
          return
        }
        const novaCat = props.categorias.find((c) => c.id === novaCategoriaId)
        toast({
          title:
            data.updated === 1
              ? `Movido pra "${novaCat?.name ?? 'categoria'}"`
              : `${data.updated} movidas pra "${novaCat?.name ?? 'categoria'}"`,
          description: data.totalAmount
            ? formatBRL(data.totalAmount)
            : undefined,
        })
        // Guarda último para undo + oferta de regra
        const firstTx = txIds.map((id) => txById.get(id)).find(Boolean)
        setLastRecat({
          previousByTxId: data.previousByTxId ?? {},
          novaCategoria: { id: novaCategoriaId, name: novaCat?.name ?? '' },
          affectedIds: txIds,
          sampleDescription: firstTx?.description,
        })
        // Sprint 11 — atualização OTIMISTA: move tx no breakdown + txCache local
        // SEM router.refresh() e SEM setTxCache({}). Resultado: scroll position
        // preservada, grupos continuam expandidos, Cards não desmontam.
        // Server cache foi invalidado via revalidateTag no endpoint; a próxima
        // navegação real verá os dados do server, mas a página atual segue
        // com seu estado otimista (que é exato, porque sabemos qual tx moveu).
        const moved = applyOptimisticMove({
          breakdown,
          txCache,
          txById,
          txIds,
          novaCategoriaId,
          categoriasCatalogo: props.categorias,
        })
        setBreakdown(moved.breakdown)
        setTxCache(moved.txCache)
        // Limpa seleção (lote) e fecha picker
        setSelectedIds(new Set())
        setPickerOpenFor(null)
      } finally {
        setRecategorizing(false)
      }
    },
    [props.empresaId, props.categorias, toast, txById, breakdown, txCache],
  )

  const undoLastRecat = useCallback(async () => {
    if (!lastRecat) return
    // Inverte: agrupa ids por categoria original e faz POST por grupo
    const byPrevious = new Map<string, string[]>()
    const orphans: string[] = []
    for (const id of lastRecat.affectedIds) {
      const prev = lastRecat.previousByTxId[id]
      if (!prev) {
        orphans.push(id)
        continue
      }
      const arr = byPrevious.get(prev) ?? []
      arr.push(id)
      byPrevious.set(prev, arr)
    }
    if (orphans.length > 0) {
      toast({
        variant: 'destructive',
        title: 'Desfazer impossível',
        description: `${orphans.length} sem categoria anterior. Recategorize manualmente.`,
      })
    }
    let totalUndone = 0
    // Sprint 11 — também otimista no undo. Acumula movimentos pra aplicar
    // depois de TODOS os POSTs OK (ou parciais), mantendo scroll/expansão.
    let curBreakdown = breakdown
    let curTxCache = txCache
    for (const [prevCatId, ids] of byPrevious) {
      const res = await fetch(
        `/api/empresas/${props.empresaId}/despesas/recategorizar`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transactionIds: ids,
            novaCategoriaId: prevCatId,
          }),
          credentials: 'include',
        },
      )
      if (res.ok) {
        const data = await res.json()
        totalUndone += data.updated ?? 0
        // Aplica otimisticamente o movimento inverso (ids voltam pra prevCatId).
        // Rebuilda txById local com curTxCache pra refletir movimentos já aplicados.
        const localTxById = new Map<string, ExpenseTransactionItem>()
        for (const entry of Object.values(curTxCache)) {
          for (const t of entry.items) localTxById.set(t.id, t)
        }
        const moved = applyOptimisticMove({
          breakdown: curBreakdown,
          txCache: curTxCache,
          txById: localTxById,
          txIds: ids,
          novaCategoriaId: prevCatId,
          categoriasCatalogo: props.categorias,
        })
        curBreakdown = moved.breakdown
        curTxCache = moved.txCache
      }
    }
    setBreakdown(curBreakdown)
    setTxCache(curTxCache)
    toast({
      title: 'Desfeito',
      description:
        totalUndone === 1
          ? '1 transação voltou pra categoria anterior.'
          : `${totalUndone} transações voltaram pra categoria anterior.`,
    })
    setLastRecat(null)
  }, [lastRecat, props.empresaId, props.categorias, breakdown, txCache, toast])

  // Sugere um padrão "CONTAINS" a partir da primeira tx recategorizada (Fase 3).
  // Heurística: primeiras 2 palavras significativas (sem números).
  const ruleSuggestion = useMemo(() => {
    if (!lastRecat?.sampleDescription) return null
    const tokens = lastRecat.sampleDescription
      .replace(/[^\w\sÀ-ÿ]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !/^\d+$/.test(w))
    if (tokens.length === 0) return null
    const padrao = tokens.slice(0, 2).join(' ').toUpperCase()
    return {
      padrao,
      novaCategoriaId: lastRecat.novaCategoria.id,
      novaCategoriaName: lastRecat.novaCategoria.name,
    }
  }, [lastRecat])

  function dismissOfertaRegra() {
    setLastRecat(null)
  }

  function exportCsv() {
    const params = new URLSearchParams({
      regime: props.regime,
      de: props.periodStart,
      ate: props.periodEnd,
    })
    if (contaFilter && contaFilter !== 'all') params.set('contaId', contaFilter)
    if (query.trim()) params.set('q', query.trim())
    window.location.href = `/api/empresas/${props.empresaId}/despesas/export?${params.toString()}`
  }

  const periodoLabel = formatPeriodoLabel(props.periodStart, props.periodEnd)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            Voltar pro Dashboard
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Despesas</h1>
          <p className="text-sm text-muted-foreground">
            {props.empresaNome} · {periodoLabel} · regime{' '}
            <span className="font-medium text-foreground">
              {props.regime === 'caixa' ? 'caixa' : 'competência'}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportCsv}
            className="gap-1.5"
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Banner informativo */}
      <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 px-4 py-3 flex items-start gap-3 text-sm">
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
        <div className="text-foreground/90">
          <span className="font-medium">Transferências entre contas e empréstimos não entram aqui</span> —
          não são despesa. Veja em{' '}
          <Link href={`/empresas/${props.empresaId}/transferencias`} className="underline hover:text-blue-600">
            Transferências
          </Link>{' '}
          /{' '}
          <Link href={`/empresas/${props.empresaId}/emprestimos`} className="underline hover:text-blue-600">
            Empréstimos
          </Link>
          . Retiradas de sócio (distribuição de lucros) também ficam de fora.
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          label="Total de despesas"
          value={formatBRL(breakdown.totalGeral)}
          accent="text-red-600 dark:text-red-400"
          big
        />
        <StatCard
          label="Transações"
          value={String(breakdown.totalTx)}
        />
        <StatCard
          label="Categorias"
          value={String(breakdown.totalCategorias)}
        />
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="py-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Regime</label>
            <Select
              value={props.regime}
              onValueChange={(v) => updateUrl({ regime: v === 'caixa' ? null : v })}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="caixa">Caixa</SelectItem>
                <SelectItem value="competencia">Competência</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">De</label>
            <Input
              type="date"
              defaultValue={props.periodStart}
              className="h-9"
              onChange={(e) => updateUrl({ de: e.target.value || null })}
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Até</label>
            <Input
              type="date"
              defaultValue={props.periodEnd}
              className="h-9"
              onChange={(e) => updateUrl({ ate: e.target.value || null })}
            />
          </div>
          <div className="md:col-span-3">
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Conta / banco</label>
            <Select value={contaFilter} onValueChange={setContaFilter}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Todas as contas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as contas</SelectItem>
                {props.contas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-3">
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Buscar descrição</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="aluguel, energia, fornecedor..."
                className="h-9 pl-8"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ordenação + indicador de pending */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Ordenar por:</span>
          <button
            onClick={() => setOrderBy('gasto')}
            className={`text-sm font-medium ${orderBy === 'gasto' ? 'text-foreground underline underline-offset-4' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Maior gasto
          </button>
          <span className="text-muted-foreground/40">·</span>
          <button
            onClick={() => setOrderBy('nome')}
            className={`text-sm font-medium ${orderBy === 'nome' ? 'text-foreground underline underline-offset-4' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Nome (A-Z)
          </button>
        </div>
        {(isPending || recategorizing) && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            {recategorizing ? 'Recategorizando…' : 'Atualizando…'}
          </div>
        )}
      </div>

      {/* Sprint 10 — Barra sticky de ação em lote */}
      {selectedIds.size > 0 && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          selectedAmount={selectedAmount}
          onClear={clearSelection}
          onChangeCategory={(e) => {
            openPickerFor(
              Array.from(selectedIds),
              e.currentTarget.getBoundingClientRect(),
            )
          }}
        />
      )}

      {/* Sprint 10 — Banner de oferta de regra (Fase 3, opcional + explícito) */}
      {lastRecat && ruleSuggestion && (
        <OfertaRegraBanner
          empresaId={props.empresaId}
          padrao={ruleSuggestion.padrao}
          categoriaNome={ruleSuggestion.novaCategoriaName}
          categoriaId={ruleSuggestion.novaCategoriaId}
          onUndo={undoLastRecat}
          onDismiss={dismissOfertaRegra}
        />
      )}

      {/* Lista de categorias */}
      {categoriasOrdenadas.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-1.5">
          {categoriasOrdenadas.map((cat) => {
            const isExpanded = expanded.has(cat.categoryId)
            const tx = txCache[cat.categoryId]
            return (
              <Card
                key={cat.categoryId}
                className="overflow-hidden transition-colors"
              >
                <button
                  type="button"
                  onClick={() => toggleCategory(cat.categoryId)}
                  className="w-full text-left px-4 py-3 hover:bg-muted/40 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-foreground" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">{cat.name}</span>
                        <span
                          className={`text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded ${DRE_GROUP_COLOR[cat.dreGroup] ?? 'bg-zinc-500/15 text-zinc-700'}`}
                        >
                          {DRE_GROUP_LABEL[cat.dreGroup] ?? cat.dreGroup}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {cat.qtdTx} tx
                        </span>
                      </div>
                      {/* Barra proporcional */}
                      <div className="mt-2 h-1.5 w-full bg-muted/50 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-rose-400 to-rose-500 rounded-full transition-all"
                          style={{ width: `${Math.min(100, cat.pctDoTotal)}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-semibold tabular-nums text-red-600 dark:text-red-400">
                        {formatBRL(cat.total)}
                      </div>
                      <div className="text-xs text-muted-foreground tabular-nums">
                        {cat.pctDoTotal.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </button>
                {isExpanded && (
                  <div className="border-t bg-muted/20">
                    {tx?.loading ? (
                      <div className="py-6 flex items-center justify-center text-sm text-muted-foreground gap-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        carregando transações…
                      </div>
                    ) : tx && tx.items.length > 0 ? (
                      <TxTable
                        items={tx.items}
                        total={tx.total}
                        categoryId={cat.categoryId}
                        empresaId={props.empresaId}
                        selectedIds={selectedIds}
                        onToggleSelect={toggleSelect}
                        onSelectAll={() => selectAllInCategory(cat.categoryId, tx.items)}
                        onOpenPicker={openPickerFor}
                      />
                    ) : (
                      <div className="py-4 text-center text-xs text-muted-foreground">
                        Sem transações no filtro atual.
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Rodapé técnico */}
      <p className="text-xs text-muted-foreground text-center pt-4">
        Lendo do mesmo motor do dashboard ·{' '}
        <span className="font-mono">getExpenseBreakdown</span> · TRANSFER + DISTRIBUIÇÃO de lucros + INVESTIMENTOS excluídos
      </p>

      {/* Sprint 10 — CategoryPicker compartilhado (inline + lote) */}
      <CategoryPicker
        open={pickerOpenFor !== null}
        categorias={props.categorias}
        currentCategoryId={
          pickerOpenFor && pickerOpenFor.txIds.length === 1
            ? txById.get(pickerOpenFor.txIds[0])?.categoryId
            : undefined
        }
        loading={recategorizing}
        onClose={() => setPickerOpenFor(null)}
        onPick={(catId) => {
          if (pickerOpenFor) recategorize(pickerOpenFor.txIds, catId)
        }}
        anchorRect={pickerOpenFor?.anchorRect ?? null}
      />
    </div>
  )
}

function StatCard({ label, value, accent, big }: { label: string; value: string; accent?: string; big?: boolean }) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
          {label}
        </div>
        <div className={`mt-1 tabular-nums font-semibold ${big ? 'text-2xl' : 'text-xl'} ${accent ?? ''}`}>
          {value}
        </div>
      </CardContent>
    </Card>
  )
}

function TxTable({
  items,
  total,
  categoryId,
  empresaId,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onOpenPicker,
}: {
  items: ExpenseTransactionItem[]
  total: number
  categoryId: string
  empresaId: string
  selectedIds: Set<string>
  onToggleSelect: (txId: string) => void
  onSelectAll: () => void
  onOpenPicker: (txIds: string[], anchorRect: DOMRect | null) => void
}) {
  const allSelected = items.length > 0 && items.every((t) => selectedIds.has(t.id))
  const someSelected = !allSelected && items.some((t) => selectedIds.has(t.id))
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b">
            <th className="px-4 py-2 font-medium w-8">
              <Checkbox
                checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                onCheckedChange={() => onSelectAll()}
                aria-label="Selecionar todas"
              />
            </th>
            <th className="px-4 py-2 font-medium">Data</th>
            <th className="px-4 py-2 font-medium">Descrição</th>
            <th className="px-4 py-2 font-medium">Categoria</th>
            <th className="px-4 py-2 font-medium">Fornecedor</th>
            <th className="px-4 py-2 font-medium">Banco</th>
            <th className="px-4 py-2 font-medium text-right">Valor</th>
          </tr>
        </thead>
        <tbody>
          {items.map((t) => {
            const isSelected = selectedIds.has(t.id)
            return (
              <tr
                key={t.id}
                className={`border-b last:border-b-0 transition-colors ${
                  isSelected ? 'bg-primary/5' : 'hover:bg-muted/40'
                }`}
              >
                <td className="px-4 py-2 w-8">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggleSelect(t.id)}
                    aria-label={`Selecionar ${t.description}`}
                  />
                </td>
                <td className="px-4 py-2 tabular-nums text-xs text-muted-foreground whitespace-nowrap">
                  {formatDateBR(t.date)}
                </td>
                <td className="px-4 py-2 truncate max-w-[260px]">{t.description}</td>
                <td className="px-4 py-2">
                  {/* Sprint 10 — célula categoria clicável (inline) */}
                  <button
                    type="button"
                    onClick={(e) =>
                      onOpenPicker([t.id], e.currentTarget.getBoundingClientRect())
                    }
                    className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border border-dashed border-muted-foreground/30 hover:border-foreground/40 hover:bg-muted/50 transition-colors max-w-[160px]"
                    title="Mudar categoria"
                  >
                    <Tag className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="truncate text-foreground/80">
                      {t.categoryName}
                    </span>
                    <ChevronDown className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                  </button>
                </td>
                <td className="px-4 py-2 text-xs text-muted-foreground truncate max-w-[140px]">
                  {t.supplierName ?? '—'}
                </td>
                <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                  <span className="inline-flex items-center gap-1">
                    <Wallet className="h-3 w-3" />
                    {t.bankAccountName ?? '—'}
                  </span>
                </td>
                <td className="px-4 py-2 text-right tabular-nums font-medium text-red-600 dark:text-red-400">
                  {formatBRL(t.amount)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {total > items.length && (
        <div className="px-4 py-2.5 text-xs text-muted-foreground border-t bg-muted/10">
          Mostrando {items.length} de {total} transações.{' '}
          <Link
            href={`/transacoes?empresaId=${empresaId}&categoria=${categoryId}`}
            className="text-blue-600 hover:underline"
          >
            Ver todas em Movimentações →
          </Link>
        </div>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <div className="flex justify-center mb-3">
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
        <p className="font-medium">Nenhuma despesa no período</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
          Ajuste o período ou os filtros pra ver despesas.
          Lembre-se: transferências, distribuição de lucros e empréstimos não aparecem aqui.
        </p>
      </CardContent>
    </Card>
  )
}

// Sprint 10 — Barra sticky de ação em lote (aparece quando N >= 1)
function BulkActionBar({
  selectedCount,
  selectedAmount,
  onChangeCategory,
  onClear,
}: {
  selectedCount: number
  selectedAmount: number
  onChangeCategory: (e: React.MouseEvent<HTMLButtonElement>) => void
  onClear: () => void
}) {
  return (
    <div className="sticky top-2 z-30">
      <div className="rounded-lg border bg-card shadow-md px-4 py-2.5 flex items-center gap-3 flex-wrap">
        <span className="text-sm font-medium tabular-nums">
          {selectedCount} selecionada{selectedCount === 1 ? '' : 's'}
        </span>
        <span className="text-xs text-muted-foreground">·</span>
        <span className="text-sm tabular-nums text-muted-foreground">
          {formatBRL(selectedAmount)}
        </span>
        <span className="text-xs text-muted-foreground">·</span>
        <Button
          size="sm"
          onClick={onChangeCategory}
          className="gap-1.5 h-8"
        >
          <Tag className="h-3.5 w-3.5" />
          Mudar categoria…
        </Button>
        <button
          type="button"
          onClick={onClear}
          className="ml-auto text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
        >
          <X className="h-3 w-3" />
          limpar
        </button>
      </div>
    </div>
  )
}

// Sprint 10 — Banner discreto de oferta de regra (Fase 3, opcional)
function OfertaRegraBanner({
  empresaId,
  padrao,
  categoriaNome,
  categoriaId,
  onUndo,
  onDismiss,
}: {
  empresaId: string
  padrao: string
  categoriaNome: string
  categoriaId: string
  onUndo: () => void | Promise<void>
  onDismiss: () => void
}) {
  const { toast } = useToast()
  const [previewCount, setPreviewCount] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    let aborted = false
    fetch(`/api/empresas/${empresaId}/regras/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ padrao, tipoMatch: 'CONTAINS' }),
      credentials: 'include',
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (aborted) return
        if (d) setPreviewCount(d.count ?? 0)
      })
      .catch(() => {})
    return () => {
      aborted = true
    }
  }, [empresaId, padrao])

  async function criarRegra() {
    setCreating(true)
    try {
      const res = await fetch(
        `/api/empresas/${empresaId}/rules/create-and-apply`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            padrao,
            tipoMatch: 'CONTAINS',
            categoryId: categoriaId,
            applyToExisting: true,
          }),
          credentials: 'include',
        },
      )
      const data = await res.json()
      if (!res.ok) {
        toast({
          variant: 'destructive',
          title: 'Erro',
          description: data.erro ?? 'Falha ao criar regra.',
        })
        return
      }
      toast({
        title: 'Regra criada',
        description: data.appliedTo
          ? `Classificou +${data.appliedTo} transação${data.appliedTo === 1 ? '' : 'es'} no fluxo.`
          : 'Ativa para próximas transações.',
      })
      onDismiss()
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 flex items-center gap-3 flex-wrap">
      <Sparkles className="h-4 w-4 text-primary shrink-0" />
      <div className="text-sm flex-1 min-w-0">
        <span className="text-muted-foreground">Quer aplicar isso sempre?</span>{' '}
        <span className="font-medium">
          Descrição contém &quot;{padrao}&quot; → {categoriaNome}
        </span>
        {previewCount !== null && previewCount > 0 && (
          <span className="text-xs text-muted-foreground ml-2">
            (vai pegar +{previewCount} pendente{previewCount === 1 ? '' : 's'})
          </span>
        )}
      </div>
      <Button
        size="sm"
        variant="default"
        onClick={() => void criarRegra()}
        disabled={creating}
        className="h-8 gap-1.5"
      >
        {creating && <Loader2 className="h-3 w-3 animate-spin" />}
        Criar regra
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => void onUndo()}
        className="h-8 gap-1.5"
      >
        <Undo2 className="h-3 w-3" />
        Desfazer
      </Button>
      <button
        type="button"
        onClick={onDismiss}
        className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        aria-label="Dispensar"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function formatPeriodoLabel(start: string, end: string): string {
  const s = new Date(`${start}T00:00:00`)
  const e = new Date(`${end}T00:00:00`)
  const mesmoMes = s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()
  if (mesmoMes) {
    return s.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  }
  return `${formatDateBR(start)} → ${formatDateBR(end)}`
}

function formatDateBR(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}
