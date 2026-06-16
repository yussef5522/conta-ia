'use client'

// Sprint A-effected Fase B.2 — Find & Match Panel
//
// Sprint Find&Match World-Class (15/06/2026):
//   - Candidatos ranqueados por scoreMatch (DESC).
//   - Selo "Provável" (verde ≥90) / "Quase" (âmbar 70-89) / sem selo (<70).
//   - Chips do "porque" usando reasons[] estáveis do backend.
//   - Banner nudge "isso é Create" quando nenhum candidato tem valor próximo.
//   - Filtro de janela de data (±15d default, opção "Todas as datas").
//   - Paginação top 15 + "Ver mais" quando hasMore=true.

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Search,
  Loader2,
  X,
  Check,
  Plus,
  Tag,
  Sparkles,
  CalendarRange,
  ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'
import {
  AdjustmentMenu,
  AdjustmentForm,
  EnsureAdjustmentCategoriesModal,
  buildAdjustmentDescription,
  type PendingAdjustment,
  type AdjustmentCategoryStatus,
} from './adjustment-controls'
import {
  adjustmentSignedAmount,
} from '@/lib/conciliacao/create-adjustment'
import type { AdjustmentCategoryTemplate } from '@/lib/conciliacao/adjustment-categories'
import type { MatchReason } from '@/lib/conciliacao/match'

// Cap de ajustes por reconcile (decisão Yussef #6)
const MAX_ADJUSTMENTS = 3

interface OfxLine {
  id: string
  description: string
  amount: number
  date: string
  type: string
}

interface Candidate {
  id: string
  description: string
  amount: number
  date: string
  dueDate: string | null
  paymentDate: string | null
  lifecycle: string
  origin: string
  externalId: string | null
  supplier: {
    id: string
    razaoSocial: string
    nomeFantasia: string | null
    cnpj: string | null
  } | null
  // Sprint Find&Match World-Class
  score: number
  reasons: MatchReason[]
}

interface RankingInfo {
  totalRanked: number
  page: number
  limit: number
  hasMore: boolean
  topScore: number
  hasAnyAmountClose: boolean
  nudgeCreate: boolean
  windowDays: number | 'all'
}

interface Props {
  ofx: OfxLine
  empresaId: string
  onCancel: () => void
  onReconciled: () => void
  /** Sprint Find&Match World-Class: nudge "→ Create" chama esta callback
   *  que troca o card direito de volta pro modo tabs com `Create` ativo. */
  onSwitchToCreate?: () => void
}

const SEARCH_DEBOUNCE_MS = 300

type WindowOption = '15' | '30' | '90' | 'all'

const WINDOW_OPTIONS: Array<{ id: WindowOption; label: string }> = [
  { id: '15', label: '±15 dias (recomendado)' },
  { id: '30', label: '±30 dias' },
  { id: '90', label: '±90 dias' },
  { id: 'all', label: 'Todas as datas' },
]

// Sprint Find&Match World-Class — labels e estilos por reason key.
// Verde = sinal forte de match real; primary roxo = sinal médio; cinza = fraco.
const REASON_LABEL: Record<MatchReason, string> = {
  VALOR_EXATO: 'Mesmo valor',
  VALOR_PROXIMO_1PCT: 'Valor quase exato',
  VALOR_PROXIMO_5PCT: 'Valor próximo',
  DATA_MESMA: 'Mesma data',
  DATA_D1: 'Data D±1',
  DATA_PROXIMA: 'Data próxima',
  DATA_SEMANA: 'Mesma semana',
  FORNECEDOR_IGUAL: 'Mesmo fornecedor',
  DESC_MUITO_SIMILAR: 'Descrição parecida',
  DESC_SIMILAR: 'Descrição similar',
}

function reasonStyle(reason: MatchReason): string {
  if (reason === 'VALOR_EXATO') {
    return 'bg-emerald-50 text-emerald-700 ring-emerald-300'
  }
  if (reason === 'VALOR_PROXIMO_1PCT' || reason === 'FORNECEDOR_IGUAL') {
    return 'bg-emerald-50/60 text-emerald-700 ring-emerald-200'
  }
  if (
    reason === 'VALOR_PROXIMO_5PCT' ||
    reason === 'DATA_MESMA' ||
    reason === 'DATA_D1' ||
    reason === 'DESC_MUITO_SIMILAR'
  ) {
    return 'bg-primary/10 text-primary ring-primary/30'
  }
  return 'bg-slate-100 text-slate-600 ring-slate-200'
}

function confidenceTier(score: number): 'STRONG' | 'WEAK' | null {
  if (score >= 90) return 'STRONG'
  if (score >= 70) return 'WEAK'
  return null
}

export function FindAndMatchPanel({
  ofx,
  empresaId,
  onCancel,
  onReconciled,
  onSwitchToCreate,
}: Props) {
  const { toast } = useToast()
  const [busca, setBusca] = useState('')
  const [windowDays, setWindowDays] = useState<WindowOption>('15')
  const [loading, setLoading] = useState(false)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [ranking, setRanking] = useState<RankingInfo | null>(null)
  const [page, setPage] = useState(0)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Sprint A-effected Fase B.4.2 — ajustes pendentes (cap 3)
  const [adjustments, setAdjustments] = useState<PendingAdjustment[]>([])
  const [adjustmentFormOpen, setAdjustmentFormOpen] = useState<{
    preset: {
      categoryId: string
      categoryName: string
      sign: 'EXPENSE' | 'INCOME'
      description: string
      amount: number
    } | null
  } | null>(null)
  const [categoriesStatus, setCategoriesStatus] = useState<
    AdjustmentCategoryStatus[]
  >([])
  const [ensureModalOpen, setEnsureModalOpen] = useState(false)

  // Fetch status das 4 categorias defaults (na 1ª carga)
  const fetchCategoriesStatus = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/conciliacao/adjustment-categories?empresaId=${empresaId}`,
        { credentials: 'include' },
      )
      if (res.ok) {
        const data = await res.json()
        setCategoriesStatus(data.status as AdjustmentCategoryStatus[])
      }
    } catch {
      // silent: dropdown vai oferecer "criar" se status vier vazio
    }
  }, [empresaId])

  useEffect(() => {
    void fetchCategoriesStatus()
  }, [fetchCategoriesStatus])

  const fetchCandidates = useCallback(
    async (term: string, pageNum: number, win: WindowOption, replace: boolean) => {
      // Aborta fetch anterior pra evitar race condition (lição Sprint B.4 bug 3)
      if (abortRef.current) abortRef.current.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setLoading(true)
      try {
        const qs = new URLSearchParams({
          empresaId,
          ofxTransactionId: ofx.id,
          page: String(pageNum),
          limit: '15',
          windowDays: win,
        })
        if (term.trim()) qs.set('busca', term.trim())
        const res = await fetch(`/api/conciliacao/find-and-match?${qs}`, {
          credentials: 'include',
          signal: controller.signal,
        })
        if (!res.ok) return
        const data = await res.json()
        if (abortRef.current !== controller) return // stale response
        if (replace) {
          setCandidates(data.candidates as Candidate[])
        } else {
          // Append (ver mais)
          setCandidates((prev) => [...prev, ...(data.candidates as Candidate[])])
        }
        setRanking(data.ranking as RankingInfo)
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
      } finally {
        if (abortRef.current === controller) setLoading(false)
      }
    },
    [empresaId, ofx.id],
  )

  // Debounce search/window: reseta pra página 0
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPage(0)
      setSelectedIds(new Set())
      void fetchCandidates(busca, 0, windowDays, true)
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [busca, windowDays, fetchCandidates])

  function loadMore() {
    const next = page + 1
    setPage(next)
    void fetchCandidates(busca, next, windowDays, false)
  }

  function toggleCandidate(id: string) {
    setSelectedIds((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const statementAmount = Math.abs(ofx.amount)
  const candidatesTotal = candidates
    .filter((c) => selectedIds.has(c.id))
    .reduce((acc, c) => acc + Math.abs(c.amount), 0)
  const adjustmentsSigned = adjustments.reduce(
    (acc, a) => acc + adjustmentSignedAmount(a.amount, a.sign),
    0,
  )
  const selectedTotal = candidatesTotal + adjustmentsSigned
  const diffBeforeAdjustments = statementAmount - candidatesTotal
  const diff = statementAmount - selectedTotal
  const diffAbs = Math.abs(diff)
  const bate = diffAbs <= 0.01

  // Handlers de ajuste
  function handlePickTemplate(
    template: AdjustmentCategoryTemplate,
    existingId: string,
  ) {
    if (adjustments.length >= MAX_ADJUSTMENTS) {
      toast({
        variant: 'destructive',
        title: `Limite de ${MAX_ADJUSTMENTS} ajustes por conciliação`,
      })
      return
    }
    const sign: 'EXPENSE' | 'INCOME' =
      template.type === 'INCOME' ? 'INCOME' : 'EXPENSE'
    setAdjustmentFormOpen({
      preset: {
        categoryId: existingId,
        categoryName: template.name,
        sign,
        description: buildAdjustmentDescription(template, ofx.description),
        amount: Math.abs(diffBeforeAdjustments),
      },
    })
  }

  function handlePickOther() {
    if (adjustments.length >= MAX_ADJUSTMENTS) {
      toast({
        variant: 'destructive',
        title: `Limite de ${MAX_ADJUSTMENTS} ajustes por conciliação`,
      })
      return
    }
    setAdjustmentFormOpen({ preset: null })
  }

  function handleSaveAdjustment(adj: Omit<PendingAdjustment, 'localId'>) {
    setAdjustments((arr) => [
      ...arr,
      { ...adj, localId: `adj_${Date.now()}_${arr.length}` },
    ])
    setAdjustmentFormOpen(null)
  }

  function removeAdjustment(localId: string) {
    setAdjustments((arr) => arr.filter((a) => a.localId !== localId))
  }

  async function aplicarReconcile() {
    if (!bate || selectedIds.size === 0) return
    const candidateIds = Array.from(selectedIds)
    setSubmitting(true)
    try {
      const res = await fetch('/api/conciliacao/find-and-match/reconcile', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ofxTransactionId: ofx.id,
          candidateIds,
          adjustments: adjustments.map((a) => ({
            categoryId: a.categoryId,
            amount: a.amount,
            sign: a.sign,
            description: a.description,
          })),
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({
          variant: 'destructive',
          title: 'Falha ao reconciliar',
          description: body.erro ?? `HTTP ${res.status}`,
        })
        return
      }
      if (body.failed > 0) {
        toast({
          variant: 'destructive',
          title: `${body.reconciled} reconciliada(s), ${body.failed} falharam`,
          description: body.errors?.[0]?.error ?? 'Veja os logs.',
        })
        return
      }
      const adjN = body.adjustmentsCreated ?? 0
      toast({
        title:
          body.reconciled === 1 && adjN === 0
            ? 'Reconciled'
            : `${body.reconciled} reconciled${adjN > 0 ? ` + ${adjN} ajuste${adjN > 1 ? 's' : ''}` : ''}`,
        description: ofx.description.slice(0, 50),
      })
      onReconciled()
    } finally {
      setSubmitting(false)
    }
  }

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('pt-BR') : '—'

  const isCredit = ofx.type === 'CREDIT'
  // Nudge "isso provavelmente é Create" — banner âmbar/azul no topo.
  const showNudge = ranking !== null && ranking.nudgeCreate && !busca.trim()

  // TODO Fase 2: linha de ajuste/baixa parcial pra diferença de tarifa
  //              (UI já tem AdjustmentMenu; melhorias de fluxo ficam pra depois).
  // TODO Fase 2: limpeza dos EFFECTED órfãos do Excel (filtro/aba dedicada).

  return (
    <div className="space-y-3">
      {/* ============================================================== */}
      {/* HEADER — Statement line / Selected / Diff (preserva B.2/B.3)     */}
      {/* ============================================================== */}
      <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-sm">
        <span>
          <span className="text-muted-foreground">Statement line:</span>{' '}
          <strong className="tabular-nums">{formatBRL(statementAmount)}</strong>
        </span>
        <span>
          <span className="text-muted-foreground">Selected:</span>{' '}
          <strong className="tabular-nums">{formatBRL(selectedTotal)}</strong>
        </span>
        <span
          className={`font-semibold tabular-nums ${
            bate ? 'text-emerald-700' : 'text-amber-700'
          }`}
        >
          Diff: {formatBRL(diffAbs)}
          {bate ? ' ✓' : ''}
        </span>
        <span className="ml-auto text-xs text-muted-foreground">
          {ranking
            ? `${ranking.totalRanked} ranqueado${ranking.totalRanked === 1 ? '' : 's'}`
            : ''}
        </span>
      </div>

      {/* ============================================================== */}
      {/* NUDGE — "isso é Create" (caso JUROS R$ 1.546,70 da Cacula)      */}
      {/* ============================================================== */}
      {showNudge && (
        <div
          data-testid="nudge-create"
          className="rounded border ring-[0.5px] ring-amber-200/70 border-amber-200 bg-amber-50/40 px-3 py-2.5 flex items-start gap-3"
        >
          <Sparkles className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0 text-sm">
            <p className="font-medium text-amber-900">
              Nenhum candidato com valor próximo de {formatBRL(statementAmount)}.
            </p>
            <p className="text-xs text-amber-800/80 mt-0.5">
              Provavelmente esta é uma {isCredit ? 'receita' : 'despesa'} nova
              (juros do banco, tarifa, ajuste). Crie uma entrada nova em vez de
              forçar match.
            </p>
          </div>
          {onSwitchToCreate && (
            <Button
              type="button"
              size="sm"
              onClick={onSwitchToCreate}
              className="h-7 bg-amber-600 hover:bg-amber-700 shrink-0"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Criar entrada
              <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* CONTROLES — Busca + janela de data                              */}
      {/* ============================================================== */}
      <div className="flex items-stretch gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, NF, CNPJ, valor…"
            className="pl-9 ring-[0.5px] ring-primary/20 focus-visible:ring-primary/50"
            autoFocus
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
          )}
        </div>
        <Select
          value={windowDays}
          onValueChange={(v) => setWindowDays(v as WindowOption)}
        >
          <SelectTrigger
            className="w-[180px] ring-[0.5px] ring-primary/20"
            aria-label="Janela de data"
          >
            <CalendarRange className="h-3.5 w-3.5 mr-1 text-primary" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WINDOW_OPTIONS.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ============================================================== */}
      {/* LISTA — ranqueada DESC com selo + chips                          */}
      {/* ============================================================== */}
      <div className="border rounded bg-card max-h-[28rem] overflow-y-auto ring-[0.5px] ring-primary/10">
        {candidates.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {loading
              ? 'Buscando…'
              : busca
                ? `Nenhuma conta pendente bate com "${busca}".`
                : 'Nenhuma conta pendente disponível na janela escolhida.'}
          </div>
        ) : (
          <ul className="divide-y">
            {candidates.map((c) => {
              const isSelected = selectedIds.has(c.id)
              const dateShow = c.dueDate ?? c.paymentDate ?? c.date
              const supplierName =
                c.supplier?.nomeFantasia ??
                c.supplier?.razaoSocial ??
                c.description.slice(0, 60)
              const tier = confidenceTier(c.score)
              return (
                <li
                  key={c.id}
                  className={`px-3 py-2.5 transition-colors ${
                    isSelected
                      ? 'bg-emerald-50/50 ring-[0.5px] ring-emerald-200'
                      : tier === 'STRONG'
                        ? 'bg-emerald-50/20 hover:bg-emerald-50/40'
                        : tier === 'WEAK'
                          ? 'bg-amber-50/20 hover:bg-amber-50/40'
                          : 'hover:bg-muted/40'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleCandidate(c.id)}
                    className="w-full grid grid-cols-[auto_1fr_auto] gap-3 items-start text-left"
                  >
                    <Checkbox
                      checked={isSelected}
                      className="mt-1 pointer-events-none"
                    />
                    <div className="min-w-0 space-y-1">
                      {/* Linha 1: selo + supplier + EFFECTED */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {tier === 'STRONG' && (
                          <Badge
                            data-testid="confidence-strong"
                            variant="outline"
                            className="bg-emerald-100 text-emerald-800 border-emerald-300 ring-[0.5px] ring-emerald-300 font-semibold text-[10px]"
                          >
                            <Check className="h-2.5 w-2.5 mr-0.5" />
                            Provável · {c.score}
                          </Badge>
                        )}
                        {tier === 'WEAK' && (
                          <Badge
                            data-testid="confidence-weak"
                            variant="outline"
                            className="bg-amber-100 text-amber-800 border-amber-300 ring-[0.5px] ring-amber-300 font-semibold text-[10px]"
                          >
                            Quase · {c.score}
                          </Badge>
                        )}
                        <span
                          className="text-sm font-medium truncate"
                          title={supplierName}
                        >
                          {supplierName}
                        </span>
                        {c.lifecycle === 'EFFECTED' && (
                          <Badge
                            variant="outline"
                            className="text-[9px] bg-slate-50 text-slate-600 border-slate-200"
                          >
                            EFFECTED
                          </Badge>
                        )}
                      </div>
                      {/* Linha 2: chips "porque" */}
                      {c.reasons.length > 0 && (
                        <div
                          data-testid="reason-chips"
                          className="flex items-center gap-1 flex-wrap"
                        >
                          {c.reasons.map((r) => (
                            <span
                              key={r}
                              className={`px-1.5 py-0 rounded text-[10px] font-medium ring-[0.5px] ${reasonStyle(r)}`}
                            >
                              {REASON_LABEL[r]}
                            </span>
                          ))}
                        </div>
                      )}
                      {/* Linha 3: data + ref */}
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="tabular-nums">{fmtDate(dateShow)}</span>
                        {c.externalId && (
                          <span className="font-mono truncate">
                            ref {c.externalId}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Coluna direita: valor */}
                    <span className="text-sm tabular-nums font-semibold text-right shrink-0">
                      {formatBRL(c.amount)}
                    </span>
                  </button>
                </li>
              )
            })}
            {ranking?.hasMore && (
              <li className="px-3 py-2.5 text-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={loadMore}
                  disabled={loading}
                  className="h-7 text-xs text-primary hover:bg-primary/5"
                >
                  {loading ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : null}
                  Ver mais ({ranking.totalRanked - candidates.length} restantes)
                </Button>
              </li>
            )}
          </ul>
        )}
      </div>

      {/* ============================================================== */}
      {/* AJUSTES — lista + form (Sprint B.4.2 preservado)                */}
      {/* ============================================================== */}
      {adjustments.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">
            Ajustes ({adjustments.length})
          </p>
          {adjustments.map((adj) => (
            <div
              key={adj.localId}
              className="flex items-center gap-2 rounded border bg-blue-50/30 border-blue-200 px-3 py-1.5 text-sm"
            >
              <Tag className="h-3.5 w-3.5 text-blue-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{adj.description}</p>
                <p className="text-[10px] text-muted-foreground">
                  {adj.categoryName} ·{' '}
                  {adj.sign === 'INCOME' ? 'Receita' : 'Despesa'}
                </p>
              </div>
              <span
                className={`text-sm tabular-nums font-semibold ${
                  adj.sign === 'INCOME' ? 'text-emerald-700' : 'text-red-600'
                }`}
              >
                {adj.sign === 'INCOME' ? '−' : '+'} {formatBRL(adj.amount)}
              </span>
              <button
                type="button"
                onClick={() => removeAdjustment(adj.localId)}
                className="text-muted-foreground hover:text-red-600"
                title="Remover ajuste"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {adjustmentFormOpen && (
        <AdjustmentForm
          empresaId={empresaId}
          preset={adjustmentFormOpen.preset}
          diff={diffBeforeAdjustments}
          onSave={handleSaveAdjustment}
          onCancel={() => setAdjustmentFormOpen(null)}
        />
      )}

      {/* ============================================================== */}
      {/* FOOTER — Cancel + Ajustar + Reconcile (preservado)              */}
      {/* ============================================================== */}
      <div className="flex justify-between items-center pt-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-3.5 w-3.5 mr-1" />
          Cancelar
        </Button>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 &&
            Math.abs(diff) > 0.01 &&
            adjustments.length < MAX_ADJUSTMENTS && (
              <AdjustmentMenu
                diff={diff}
                empresaId={empresaId}
                categoriesStatus={categoriesStatus}
                onPickTemplate={handlePickTemplate}
                onPickOther={handlePickOther}
                onNeedCreate={() => setEnsureModalOpen(true)}
              />
            )}
          <Button
            size="sm"
            onClick={aplicarReconcile}
            disabled={submitting || !bate || selectedIds.size === 0}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                Reconciliando…
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5 mr-1" />
                Reconcile
                {(selectedIds.size > 1 || adjustments.length > 0) &&
                  ` (${selectedIds.size}${
                    adjustments.length > 0 ? ` + ${adjustments.length}` : ''
                  })`}
              </>
            )}
          </Button>
        </div>
      </div>

      {ensureModalOpen && (
        <EnsureAdjustmentCategoriesModal
          empresaId={empresaId}
          status={categoriesStatus}
          onCreated={() => {
            setEnsureModalOpen(false)
            void fetchCategoriesStatus()
          }}
          onClose={() => setEnsureModalOpen(false)}
        />
      )}
    </div>
  )
}
