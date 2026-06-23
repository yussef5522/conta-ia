'use client'

// Sprint 6 — Página Despesas (drill-down do Top 5).
//
// FONTE ÚNICA: dados vêm do server component (getExpenseBreakdown). Aqui
// só toggle/filtros + expansão de categoria + fetch de transações sob
// demanda. Total exibido bate com despesaOperacional do dashboard.

import { useEffect, useMemo, useState, useTransition } from 'react'
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
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatBRL } from '@/lib/format/money'
import type {
  ExpenseBreakdownResult,
  ExpenseTransactionItem,
} from '@/lib/dashboard/expenses-breakdown'
import type { Regime } from '@/lib/dashboard/engine'

interface Conta {
  id: string
  name: string
}

interface DespesasClientProps {
  empresaId: string
  empresaNome: string
  breakdown: ExpenseBreakdownResult
  contas: Conta[]
  regime: Regime
  periodStart: string // yyyy-mm-dd
  periodEnd: string
  initialExpandedCategoryId: string | null
  initialContaId: string | null
  initialQuery: string
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

  const [expanded, setExpanded] = useState<Set<string>>(
    new Set(props.initialExpandedCategoryId ? [props.initialExpandedCategoryId] : []),
  )
  const [txCache, setTxCache] = useState<Record<string, { items: ExpenseTransactionItem[]; total: number; loading?: boolean }>>({})
  const [query, setQuery] = useState(props.initialQuery)
  const [contaFilter, setContaFilter] = useState<string>(props.initialContaId ?? 'all')
  const [orderBy, setOrderBy] = useState<'gasto' | 'nome'>('gasto')

  const [isPending, startTransition] = useTransition()

  // Categorias ordenadas
  const categoriasOrdenadas = useMemo(() => {
    const arr = [...props.breakdown.categorias]
    if (orderBy === 'nome') arr.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    else arr.sort((a, b) => b.total - a.total)
    return arr
  }, [props.breakdown.categorias, orderBy])

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
          value={formatBRL(props.breakdown.totalGeral)}
          accent="text-red-600 dark:text-red-400"
          big
        />
        <StatCard
          label="Transações"
          value={String(props.breakdown.totalTx)}
        />
        <StatCard
          label="Categorias"
          value={String(props.breakdown.totalCategorias)}
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
        {isPending && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Atualizando…
          </div>
        )}
      </div>

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
                      <TxTable items={tx.items} total={tx.total} categoryId={cat.categoryId} empresaId={props.empresaId} />
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

function TxTable({ items, total, categoryId, empresaId }: {
  items: ExpenseTransactionItem[]
  total: number
  categoryId: string
  empresaId: string
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b">
            <th className="px-4 py-2 font-medium">Data</th>
            <th className="px-4 py-2 font-medium">Descrição</th>
            <th className="px-4 py-2 font-medium">Fornecedor</th>
            <th className="px-4 py-2 font-medium">Banco</th>
            <th className="px-4 py-2 font-medium text-right">Valor</th>
          </tr>
        </thead>
        <tbody>
          {items.map((t) => (
            <tr key={t.id} className="border-b last:border-b-0 hover:bg-muted/40 transition-colors">
              <td className="px-4 py-2 tabular-nums text-xs text-muted-foreground whitespace-nowrap">
                {formatDateBR(t.date)}
              </td>
              <td className="px-4 py-2 truncate max-w-[280px]">{t.description}</td>
              <td className="px-4 py-2 text-xs text-muted-foreground truncate max-w-[160px]">
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
          ))}
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
