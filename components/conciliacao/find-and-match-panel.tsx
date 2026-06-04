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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'

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
      if (next.has(id)) {
        next.delete(id)
      } else {
        // Sprint A-effected Fase B.2 — single select only.
        // N:1 (várias notas → 1 PIX consolidado) viola UNIQUE em
        // reconciledWithId no schema atual. Schema change vai na Fase B.3.
        // Por ora: clicar outra candidate desmarca a anterior.
        next.clear()
        next.add(id)
      }
      return next
    })
  }

  const statementAmount = Math.abs(ofx.amount)
  const selectedTotal = candidates
    .filter((c) => selectedIds.has(c.id))
    .reduce((acc, c) => acc + Math.abs(c.amount), 0)
  const diff = statementAmount - selectedTotal
  const diffAbs = Math.abs(diff)
  // Tolerância <= R$ 0,01: arredondamento bancário típico (caso real CIA DA
  // FRUTA: 7 notas somam R$ 3.786,77 vs PIX R$ 3.786,78 — exato 1 centavo).
  const bate = diffAbs <= 0.01

  async function aplicarReconcile() {
    if (!bate || selectedIds.size === 0) return
    const pairs = Array.from(selectedIds).map((candidateId) => ({
      ofxTransactionId: ofx.id,
      candidateId,
    }))
    setSubmitting(true)
    try {
      const res = await fetch('/api/conciliacao/bulk-confirmar', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pairs }),
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
      toast({
        title:
          body.reconciled === 1
            ? 'Reconciled'
            : `${body.reconciled} reconciled (N:1)`,
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

      {/* Detecção N:1 — várias notas pendentes da mesma busca somam pro
          statement line. Avisa user que vai precisar de B.3. */}
      {candidates.length >= 2 &&
        candidates.reduce((s, c) => s + Math.abs(c.amount), 0) >= statementAmount * 0.95 &&
        candidates.reduce((s, c) => s + Math.abs(c.amount), 0) <= statementAmount * 1.05 && (
          <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            🚨 <strong>Pagamento consolidado N:1 detectado.</strong> Várias notas
            ({candidates.length}) somam aproximadamente {formatBRL(statementAmount)} (
            {formatBRL(candidates.reduce((s, c) => s + Math.abs(c.amount), 0))}).
            <br />
            Suporte a múltipla seleção (N:1) vem na Fase B.3 (requer migration
            de schema). Por ora, você pode escolher 1 nota representativa.
          </div>
        )}

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

      {/* Footer com Cancelar + Reconcile */}
      <div className="flex justify-between items-center pt-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-3.5 w-3.5 mr-1" />
          Cancelar
        </Button>
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
              {selectedIds.size > 1 && ` (${selectedIds.size})`}
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
