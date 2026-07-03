'use client'

// Sprint Receitas-PF (02/07/2026) — Irmã de Despesas-PF. Nivel Monarch/Copilot
// + DIFERENCIAL CAIXAOS: selo "↩ {empresa} · {data}" nas entradas via ponte.
//
// Estrutura visual (top→base):
//  1. HEADER · nome perfil + botão "+ Nova receita"
//  2. HERO gradient · "Entrou R$X · N entradas" + quebra "Retiradas PJ vs
//     Outras rendas" + insight destacado "X% da renda veio da empresa"
//  3. FILTROS · período + toggle Todas|Retiradas|Externas + busca
//  4. GRID de fontes (categorias INCOME) com tendência invertida
//     (subir=verde, cair=vermelho — mais renda é BOM)
//  5. DRILL-DOWN · lista tx com selo "↩ empresa" nas retiradas
//
// SEM `unstable_cache` — real-time.

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Building2,
  CalendarDays,
  ChevronRight,
  Landmark,
  Loader2,
  Minus,
  Plus,
  Search,
  Sparkles,
  TrendingUp,
  Undo2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'
import { CategoryCombobox } from '@/components/transacoes/category-combobox'
import { createCategoryForPF } from '@/lib/transacoes/on-create-category'
import type {
  PersonalIncomeBreakdownResult,
  PersonalIncomeCategorySummary,
  PersonalIncomeTransactionItem,
} from '@/lib/dashboard-pf/income-breakdown'
import type { PersonalCashFlowResult } from '@/lib/dashboard-pf/expenses-breakdown'

interface CategoriaMini {
  id: string
  name: string
  color: string | null
  icon?: string | null
  type: string
}

interface ContaMini {
  id: string
  name: string
}

type OriginFilter = 'both' | 'bridge' | 'externa'

interface Props {
  profileId: string
}

function todayMonthRange(): { de: string; ate: string } {
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()
  const de = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10)
  const ate = new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10)
  return { de, ate }
}

function formatDateBR(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  })
}

// ─── Card por fonte de renda ──────────────────────────────────────

function CategoryCard({
  cat,
  onToggle,
  expanded,
}: {
  cat: PersonalIncomeCategorySummary
  onToggle: () => void
  expanded: boolean
}) {
  // Semântica INVERTIDA em relação a despesas:
  //   subiu = mais renda = BOM (verde emerald)
  //   caiu  = menos renda = RUIM (vermelho rose)
  const tendenciaColor =
    cat.tendencia === 'subiu'
      ? 'text-emerald-600 dark:text-emerald-400'
      : cat.tendencia === 'caiu'
        ? 'text-rose-600 dark:text-rose-400'
        : cat.tendencia === 'nova'
          ? 'text-purple-600 dark:text-purple-400'
          : 'text-slate-500'

  const TendenciaIcon =
    cat.tendencia === 'subiu'
      ? ArrowUp
      : cat.tendencia === 'caiu'
        ? ArrowDown
        : cat.tendencia === 'nova'
          ? Sparkles
          : Minus

  const tendenciaLabel = (() => {
    if (cat.tendencia === 'nova') return 'nova este mês'
    if (cat.variacaoPct === null) return ''
    const abs = Math.abs(cat.variacaoPct * 100)
    if (cat.tendencia === 'estavel') return 'estável'
    return `${cat.tendencia === 'subiu' ? '+' : '−'}${abs.toFixed(0)}% vs mês anterior`
  })()

  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
      <Card
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onToggle()
          }
        }}
        className={`group cursor-pointer border-slate-200 bg-white transition-all hover:border-slate-300 hover:shadow-sm ${
          expanded ? 'border-primary/40 shadow-sm' : ''
        }`}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: cat.color ?? '#10b981' }}
                  aria-hidden
                />
                <p className="truncate text-sm font-medium text-slate-900">{cat.name}</p>
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                <span className="tabular-nums font-medium">{cat.qtdTx}</span> tx
                <span className="text-slate-300">·</span>
                <span className="tabular-nums">{cat.pctDoTotal.toFixed(0)}% do total</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <span className="whitespace-nowrap tabular-nums text-base font-semibold text-emerald-700">
                {formatBRL(cat.total)}
              </span>
              <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${tendenciaColor}`}>
                <TendenciaIcon className="h-3 w-3" aria-hidden />
                {tendenciaLabel}
              </span>
            </div>
            <ChevronRight
              className={`h-4 w-4 shrink-0 text-slate-300 transition-transform ${
                expanded ? 'rotate-90' : ''
              }`}
              aria-hidden
            />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ─── Linha do drill-down ──────────────────────────────────────────

function TransacaoRow({
  tx,
  categorias,
  onRecategorize,
  saving,
  profileId,
}: {
  tx: PersonalIncomeTransactionItem
  categorias: CategoriaMini[]
  onRecategorize: (txId: string, newCatId: string | null) => Promise<void>
  saving: boolean
  profileId: string
}) {
  return (
    <div className="flex items-center gap-3 border-b border-slate-100 px-3 py-2 last:border-0 hover:bg-slate-50/60">
      <div className="hidden text-[10px] tabular-nums text-slate-500 sm:block sm:w-12">
        {formatDateBR(tx.date)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-slate-900">{tx.description}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
          <span className="inline-flex items-center gap-0.5">
            <Landmark className="h-2.5 w-2.5" aria-hidden />
            {tx.bankAccountName ?? 'Conta'}
          </span>
          {tx.origem ? (
            <span
              className="inline-flex items-center gap-0.5 rounded-full bg-blue-50 px-1.5 py-0.5 font-medium text-blue-700"
              title={tx.origem.pjDescription ?? undefined}
            >
              <Undo2 className="h-2.5 w-2.5" aria-hidden />
              Retirada · {tx.origem.empresaName}
              {tx.origem.pjDate && (
                <> · {formatDateBR(tx.origem.pjDate)}</>
              )}
            </span>
          ) : (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-700">
              <TrendingUp className="h-2.5 w-2.5" aria-hidden />
              Renda própria
            </span>
          )}
        </div>
      </div>
      <div className="hidden w-40 sm:block">
        <CategoryCombobox
          value={tx.categoryId}
          categorias={categorias.map((c) => ({
            id: c.id,
            name: c.name,
            color: c.color ?? null,
            type: c.type ?? 'INCOME',
            dreGroup: null,
          }))}
          onChange={(v) => onRecategorize(tx.id, v)}
          onCreate={async (name) => {
            const cat = await createCategoryForPF(profileId, name, 'INCOME')
            if (!cat) return null
            return {
              id: cat.id,
              name: cat.name,
              color: cat.color ?? null,
              type: cat.type ?? 'INCOME',
              dreGroup: null,
            }
          }}
          disabled={saving}
          placeholder="Categorizar…"
          className="h-7 w-full justify-between border-input text-xs"
          ariaLabel="Recategorizar receita"
        />
      </div>
      <span className="whitespace-nowrap tabular-nums text-sm font-semibold text-emerald-700">
        +{formatBRL(tx.amount)}
      </span>
    </div>
  )
}

// ─── Cliente principal ────────────────────────────────────────────

export function ReceitasPFClient({ profileId }: Props) {
  const { toast } = useToast()
  const initialRange = useMemo(() => todayMonthRange(), [])

  const [de, setDe] = useState<string>(initialRange.de)
  const [ate, setAte] = useState<string>(initialRange.ate)
  const [originFilter, setOriginFilter] = useState<OriginFilter>('both')
  const [q, setQ] = useState('')
  const [expandedCat, setExpandedCat] = useState<string | null>(null)
  const [showNovaModal, setShowNovaModal] = useState(false)

  const [profileName, setProfileName] = useState<string>('Perfil')
  const [breakdown, setBreakdown] = useState<PersonalIncomeBreakdownResult | null>(null)
  const [cashflow, setCashflow] = useState<PersonalCashFlowResult | null>(null)
  const [txByCategory, setTxByCategory] = useState<
    Record<string, { items: PersonalIncomeTransactionItem[]; total: number; loading?: boolean }>
  >({})
  const [categorias, setCategorias] = useState<CategoriaMini[]>([])
  const [contas, setContas] = useState<ContaMini[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch(`/api/perfis/${profileId}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.profile?.name) setProfileName(j.profile.name)
      })
      .catch(() => {})
    fetch(`/api/perfis/${profileId}/categorias?type=INCOME`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setCategorias(j?.categories ?? []))
      .catch(() => {})
    fetch(`/api/perfis/${profileId}/contas`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setContas(j?.accounts ?? []))
      .catch(() => {})
  }, [profileId])

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ de, ate, originFilter })
      const r = await fetch(`/api/perfis/${profileId}/receitas?${qs.toString()}`, {
        credentials: 'include',
      })
      if (r.ok) {
        const j = await r.json()
        setBreakdown(j.breakdown)
        setCashflow(j.cashflow)
        for (const catId of Object.keys(txByCategory)) {
          void loadCategoryTx(catId === '__NULL__' ? null : catId)
        }
      }
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [de, ate, originFilter, profileId])

  useEffect(() => {
    reload()
  }, [reload])

  async function loadCategoryTx(categoryId: string | null) {
    const key = categoryId ?? '__NULL__'
    setTxByCategory((prev) => ({
      ...prev,
      [key]: { items: prev[key]?.items ?? [], total: prev[key]?.total ?? 0, loading: true },
    }))
    const qs = new URLSearchParams({
      de,
      ate,
      originFilter,
      categoryId: categoryId ?? 'null',
      limit: '200',
    })
    if (q.trim()) qs.set('q', q.trim())
    try {
      const r = await fetch(`/api/perfis/${profileId}/receitas/transacoes?${qs.toString()}`, {
        credentials: 'include',
      })
      if (r.ok) {
        const j = await r.json()
        setTxByCategory((prev) => ({
          ...prev,
          [key]: { items: j.items ?? [], total: j.total ?? 0, loading: false },
        }))
      }
    } catch {
      setTxByCategory((prev) => ({
        ...prev,
        [key]: { items: [], total: 0, loading: false },
      }))
    }
  }

  function toggleCategory(categoryId: string | null) {
    const key = categoryId ?? '__NULL__'
    if (expandedCat === key) {
      setExpandedCat(null)
      return
    }
    setExpandedCat(key)
    if (!txByCategory[key]) void loadCategoryTx(categoryId)
  }

  async function recategorize(txId: string, newCatId: string | null) {
    setSaving((prev) => new Set([...prev, txId]))
    try {
      // Reusa o endpoint de despesas — funciona pra qualquer tx PF (CREDIT ou DEBIT).
      const r = await fetch(`/api/perfis/${profileId}/despesas/recategorizar`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionIds: [txId], novaCategoriaId: newCatId }),
      })
      if (!r.ok) throw new Error('Falha ao recategorizar')
      toast({ title: 'Categoria atualizada' })
      void reload()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: (err as Error).message,
      })
    } finally {
      setSaving((prev) => {
        const next = new Set(prev)
        next.delete(txId)
        return next
      })
    }
  }

  // ─── Render ───

  const entrou = cashflow?.entrou ?? 0
  const entrouBridge = cashflow?.entrou_bridge ?? 0
  const entrouOutros = cashflow?.entrou_outros ?? 0
  const pctPJ = entrou > 0 ? (entrouBridge / entrou) * 100 : 0

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <Link
          href={`/perfis/${profileId}`}
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar ao perfil
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Receitas</h1>
            <p className="text-sm text-slate-500">
              Tudo o que entrou no seu bolso · {profileName}
            </p>
          </div>
          <Button
            onClick={() => setShowNovaModal(true)}
            className="shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white"
            size="lg"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Nova receita
          </Button>
        </div>
      </div>

      {/* Hero — foco em "Entrou" com quebra bridge/externa */}
      {cashflow && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-[#185FA5] to-[#0F4A8C] text-white shadow-md">
            <CardContent className="p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-white/70">
                    Entrou este mês
                  </p>
                  <p className="mt-2 text-4xl font-semibold tabular-nums tracking-tight sm:text-5xl">
                    {formatBRL(entrou)}
                  </p>
                  <p className="mt-1.5 text-sm text-white/80">
                    <span className="tabular-nums">{cashflow.qtdEntrou}</span>{' '}
                    {cashflow.qtdEntrou === 1 ? 'entrada' : 'entradas'}
                  </p>
                </div>

                {/* Diferencial CAIXAOS: insight destacado */}
                {entrou > 0 && (
                  <div className="rounded-lg bg-white/10 px-4 py-3 backdrop-blur-sm">
                    <p className="text-[11px] uppercase tracking-wide text-white/70">
                      Renda que veio da empresa
                    </p>
                    <p className="mt-1 text-3xl font-semibold tabular-nums">
                      {pctPJ.toFixed(0)}%
                    </p>
                    <p className="mt-0.5 text-xs text-white/70">
                      da sua renda total
                    </p>
                  </div>
                )}
              </div>

              {/* Quebra: PJ vs próprio */}
              {entrou > 0 && (
                <div className="mt-5 grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-2">
                  <div className="rounded-lg bg-white/5 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-2 w-2 rounded-full bg-blue-300"
                        aria-hidden
                      />
                      <p className="text-[11px] uppercase tracking-wide text-white/80">
                        Retiradas do PJ
                      </p>
                    </div>
                    <p className="mt-1 text-xl font-semibold tabular-nums">
                      {formatBRL(entrouBridge)}
                    </p>
                    <p className="text-[11px] text-white/70">
                      via ponte PJ→PF
                    </p>
                  </div>
                  <div className="rounded-lg bg-white/5 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-2 w-2 rounded-full bg-emerald-300"
                        aria-hidden
                      />
                      <p className="text-[11px] uppercase tracking-wide text-white/80">
                        Outras rendas
                      </p>
                    </div>
                    <p className="mt-1 text-xl font-semibold tabular-nums">
                      {formatBRL(entrouOutros)}
                    </p>
                    <p className="text-[11px] text-white/70">
                      freelance, aluguel, salário CLT, etc
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1">
          <CalendarDays className="h-3.5 w-3.5 text-slate-500" aria-hidden />
          <input
            type="date"
            value={de}
            onChange={(e) => setDe(e.target.value)}
            className="border-0 bg-transparent text-xs outline-none"
          />
          <span className="text-xs text-slate-400">→</span>
          <input
            type="date"
            value={ate}
            onChange={(e) => setAte(e.target.value)}
            className="border-0 bg-transparent text-xs outline-none"
          />
        </div>

        <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5">
          <button
            type="button"
            onClick={() => setOriginFilter('both')}
            className={`rounded px-3 py-1 text-xs font-medium ${
              originFilter === 'both' ? 'bg-slate-900 text-white' : 'text-slate-600'
            }`}
          >
            Todas
          </button>
          <button
            type="button"
            onClick={() => setOriginFilter('bridge')}
            className={`rounded px-3 py-1 text-xs font-medium ${
              originFilter === 'bridge' ? 'bg-slate-900 text-white' : 'text-slate-600'
            }`}
          >
            <Undo2 className="mr-1 inline h-3 w-3" aria-hidden />
            Retiradas PJ
          </button>
          <button
            type="button"
            onClick={() => setOriginFilter('externa')}
            className={`rounded px-3 py-1 text-xs font-medium ${
              originFilter === 'externa' ? 'bg-slate-900 text-white' : 'text-slate-600'
            }`}
          >
            <TrendingUp className="mr-1 inline h-3 w-3" aria-hidden />
            Externas
          </button>
        </div>

        <div className="inline-flex flex-1 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 sm:max-w-xs">
          <Search className="h-3.5 w-3.5 text-slate-400" aria-hidden />
          <Input
            placeholder="Buscar descrição…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && expandedCat)
                void loadCategoryTx(expandedCat === '__NULL__' ? null : expandedCat)
            }}
            className="h-6 border-0 bg-transparent p-0 text-xs outline-none focus-visible:ring-0"
          />
        </div>
      </div>

      {/* Header persistente */}
      {breakdown && (
        <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-3">
          <p className="text-sm text-slate-700">
            <span className="tabular-nums text-base font-semibold">{breakdown.totalTx}</span>{' '}
            {breakdown.totalTx === 1 ? 'entrada' : 'entradas'} · em{' '}
            <span className="tabular-nums font-medium">{breakdown.totalCategorias}</span> fontes
          </p>
          <p className="text-lg font-semibold tabular-nums text-emerald-700">
            {formatBRL(breakdown.totalGeral)}
          </p>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : !breakdown || breakdown.categorias.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <p className="text-sm text-slate-500">
              Nenhuma receita neste período. Que tal{' '}
              <button className="text-primary underline" onClick={() => setShowNovaModal(true)}>
                lançar a primeira
              </button>
              ?
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {breakdown.categorias.map((cat) => {
              const key = cat.categoryId ?? '__NULL__'
              const isExpanded = expandedCat === key
              const bucket = txByCategory[key]
              return (
                <div key={key}>
                  <CategoryCard
                    cat={cat}
                    expanded={isExpanded}
                    onToggle={() => toggleCategory(cat.categoryId)}
                  />
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className="mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white"
                    >
                      {bucket?.loading ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                        </div>
                      ) : !bucket || bucket.items.length === 0 ? (
                        <p className="p-4 text-center text-xs text-slate-500">
                          Nenhuma tx nesta categoria pra este filtro.
                        </p>
                      ) : (
                        bucket.items.map((tx) => (
                          <TransacaoRow
                            key={tx.id}
                            tx={tx}
                            categorias={categorias}
                            onRecategorize={recategorize}
                            saving={saving.has(tx.id)}
                            profileId={profileId}
                          />
                        ))
                      )}
                    </motion.div>
                  )}
                </div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Modal Nova Receita */}
      <NovaReceitaModal
        open={showNovaModal}
        onOpenChange={setShowNovaModal}
        profileId={profileId}
        categorias={categorias}
        contas={contas}
        onCreated={() => {
          setShowNovaModal(false)
          void reload()
        }}
      />
    </div>
  )
}

// ─── Modal Nova Receita ────────────────────────────────────────────

function NovaReceitaModal({
  open,
  onOpenChange,
  profileId,
  categorias,
  contas,
  onCreated,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  profileId: string
  categorias: CategoriaMini[]
  contas: ContaMini[]
  onCreated: () => void
}) {
  const { toast } = useToast()
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [bankAccountId, setBankAccountId] = useState<string>('')
  const [categoryId, setCategoryId] = useState<string>('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setDate(new Date().toISOString().slice(0, 10))
      setDescription('')
      setAmount('')
      setBankAccountId(contas[0]?.id ?? '')
      setCategoryId('')
      setNotes('')
    }
  }, [open, contas])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        date: new Date(date).toISOString(),
        description: description.trim(),
        amount: Math.abs(parseFloat(amount)),
        type: 'CREDIT',
        bankAccountId: bankAccountId || null,
        categoryId: categoryId || null,
        notes: notes.trim() || null,
      }
      const r = await fetch(`/api/perfis/${profileId}/transacoes`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        throw new Error(j?.erro ?? 'Falha ao criar receita')
      }
      toast({
        title: '✓ Receita lançada',
        description: `${formatBRL(parseFloat(amount))} · ${description.slice(0, 40)}`,
      })
      onCreated()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: (err as Error).message,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-lg w-[calc(100vw-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova receita</DialogTitle>
          <DialogDescription>
            Lance uma renda externa (freelance, aluguel recebido, salário CLT).
            <br />
            <span className="text-xs">
              💡 Retiradas do seu PJ entram automaticamente via ponte — não precisa lançar aqui.
            </span>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label className="text-xs">Conta</Label>
            <select
              value={bankAccountId}
              onChange={(e) => setBankAccountId(e.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-input bg-white px-2 text-sm"
            >
              <option value="">Escolha…</option>
              {contas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label className="text-xs">Valor</Label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              placeholder="0,00"
              className="mt-1 tabular-nums"
            />
          </div>
          <div>
            <Label className="text-xs">Data</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="mt-1"
            />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Descrição</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              required
              placeholder="Ex: Freelance projeto X, Aluguel apartamento…"
              className="mt-1"
            />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Categoria (fonte)</Label>
            <CategoryCombobox
              value={categoryId || null}
              categorias={categorias
                .filter((c) => c.type === 'INCOME')
                .map((c) => ({
                  id: c.id,
                  name: c.name,
                  color: c.color ?? null,
                  type: c.type,
                  dreGroup: null,
                }))}
              onChange={(v) => setCategoryId(v ?? '')}
              onCreate={async (name) => {
                const cat = await createCategoryForPF(profileId, name, 'INCOME')
                if (!cat) return null
                return {
                  id: cat.id,
                  name: cat.name,
                  color: cat.color ?? null,
                  type: 'INCOME',
                  dreGroup: null,
                }
              }}
              placeholder="Selecione (opcional)"
              className="mt-1 h-9 w-full justify-between border-input text-sm"
              ariaLabel="Categoria da receita"
            />
          </div>
          <div className="mt-1 flex justify-end gap-2 sm:col-span-2">
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving || !description.trim() || !amount}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Lançar receita
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
