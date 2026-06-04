'use client'

// Sprint A-effected Fase B.2 — Find & Match Panel
//
// Inline takeover do card direito: quando user clica "Find & Match", o
// painel de 4 tabs some e este componente expande no lugar, ocupando
// largura inteira do card direito.
//
// Resolve o caso CIA DA FRUTA (Yussef pagou R$ 3.786,78 mas auto-match
// não acha): user busca "CIA DA FRUTA", vê as notas em aberto, marca
// a NF-1234, indicador fica verde, clica Reconcile.

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Search,
  Loader2,
  X,
  Check,
  Plus,
  Minus,
  Tag,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
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
}

interface Props {
  ofx: OfxLine
  empresaId: string
  onCancel: () => void
  onReconciled: () => void
}

const SEARCH_DEBOUNCE_MS = 300

export function FindAndMatchPanel({
  ofx,
  empresaId,
  onCancel,
  onReconciled,
}: Props) {
  const { toast } = useToast()
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(false)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [totalEncontrado, setTotalEncontrado] = useState(0)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

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
    async (term: string) => {
      setLoading(true)
      try {
        const qs = new URLSearchParams({
          empresaId,
          ofxTransactionId: ofx.id,
        })
        if (term.trim()) qs.set('busca', term.trim())
        const res = await fetch(`/api/conciliacao/find-and-match?${qs}`, {
          credentials: 'include',
        })
        if (res.ok) {
          const data = await res.json()
          setCandidates(data.candidates as Candidate[])
          setTotalEncontrado(data.total)
        }
      } finally {
        setLoading(false)
      }
    },
    [empresaId, ofx.id],
  )

  // Carga inicial sem filtro (mostra alguns candidates já)
  useEffect(() => {
    void fetchCandidates('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void fetchCandidates(busca)
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [busca, fetchCandidates])

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
  // Sprint A-effected Fase B.4.2 — soma dos ajustes COM SINAL
  // EXPENSE: + (soma na seleção, banco pagou mais) / INCOME: − (banco pagou menos)
  const adjustmentsSigned = adjustments.reduce(
    (acc, a) => acc + adjustmentSignedAmount(a.amount, a.sign),
    0,
  )
  const selectedTotal = candidatesTotal + adjustmentsSigned
  // Diff antes dos ajustes (pra UI sugerir ajuste de valor exato)
  const diffBeforeAdjustments = statementAmount - candidatesTotal
  // Diff atual considerando ajustes (pra habilitar Reconcile)
  const diff = statementAmount - selectedTotal
  const diffAbs = Math.abs(diff)
  // Tolerância <= R$ 0,01: arredondamento bancário típico (caso real CIA DA
  // FRUTA: 7 notas somam R$ 3.786,77 vs PIX R$ 3.786,78 — exato 1 centavo).
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
      // Sprint A-effected Fase B.3 + B.4.2 — endpoint dedicado N:1 com ajustes.
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

  return (
    <div className="space-y-3">
      {/* Header com indicador de soma */}
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
            bate
              ? 'text-emerald-700'
              : 'text-amber-700'
          }`}
        >
          Diff: {formatBRL(diffAbs)}
          {bate ? ' ✓' : ''}
        </span>
        <span className="ml-auto text-xs text-muted-foreground">
          {totalEncontrado} encontrad{totalEncontrado === 1 ? 'a' : 'as'}
        </span>
      </div>

      {/* Sprint A-effected Fase B.3 — Multi-select habilitado.
          Marque várias notas que somam o statement line (PIX consolidado).
          O indicador Diff fica verde quando bate. */}

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, NF, CNPJ, valor (ex: 3786,78)…"
          className="pl-9"
          autoFocus
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
        )}
      </div>

      {/* Tabela de resultados */}
      <div className="border rounded bg-card max-h-96 overflow-y-auto">
        {candidates.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {loading
              ? 'Buscando…'
              : busca
                ? `Nenhuma conta pendente bate com "${busca}".`
                : 'Nenhuma conta pendente disponível.'}
          </div>
        ) : (
          <div className="divide-y">
            <div className="grid grid-cols-[auto_auto_auto_1fr_auto] gap-2 px-3 py-1.5 bg-muted/30 text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">
              <span></span>
              <span>Data</span>
              <span>Ref</span>
              <span>To/From</span>
              <span className="text-right">Valor</span>
            </div>
            {candidates.map((c) => {
              const isSelected = selectedIds.has(c.id)
              const dateShow = c.dueDate ?? c.paymentDate ?? c.date
              const supplierName =
                c.supplier?.nomeFantasia ??
                c.supplier?.razaoSocial ??
                c.description.slice(0, 40)
              return (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => toggleCandidate(c.id)}
                  className={`w-full grid grid-cols-[auto_auto_auto_1fr_auto] gap-2 px-3 py-2 items-center text-sm text-left hover:bg-muted/40 transition-colors ${
                    isSelected ? 'bg-emerald-50/40' : ''
                  }`}
                >
                  <Checkbox checked={isSelected} className="pointer-events-none" />
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {fmtDate(dateShow)}
                  </span>
                  <span className="text-xs text-muted-foreground truncate min-w-[60px]">
                    {c.externalId ?? '—'}
                  </span>
                  <span className="truncate" title={supplierName}>
                    {supplierName}
                    {c.lifecycle === 'EFFECTED' && (
                      <Badge
                        variant="outline"
                        className="ml-2 text-[9px] bg-amber-50 text-amber-700 border-amber-200"
                      >
                        EFFECTED
                      </Badge>
                    )}
                  </span>
                  <span className="text-sm tabular-nums font-semibold text-right">
                    {formatBRL(c.amount)}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Sprint A-effected Fase B.4.2 — Lista de ajustes adicionados */}
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

      {/* Sprint A-effected Fase B.4.2 — Form de novo ajuste (quando aberto) */}
      {adjustmentFormOpen && (
        <AdjustmentForm
          empresaId={empresaId}
          preset={adjustmentFormOpen.preset}
          diff={diffBeforeAdjustments}
          onSave={handleSaveAdjustment}
          onCancel={() => setAdjustmentFormOpen(null)}
        />
      )}

      {/* Footer com Cancelar + Ajustar (dropdown) + Reconcile */}
      <div className="flex justify-between items-center pt-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-3.5 w-3.5 mr-1" />
          Cancelar
        </Button>
        <div className="flex items-center gap-2">
          {/* Dropdown de ajuste — aparece só quando há candidates selecionadas
              E ainda há diff != 0 E user ainda pode adicionar (cap 3) */}
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

      {/* Modal opcional — criar categorias faltantes */}
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
