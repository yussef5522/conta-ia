'use client'

// Sprint A-effected Fase 2 — Modal de revisão pré-bulk.
//
// Mostra a lista de pares OFX↔candidato que o bulk vai conciliar.
// Yussef revisa item a item (checkbox individual), pode desmarcar
// duvidosos, e só DEPOIS clica em "Confirmar conciliação".

import { useEffect, useState } from 'react'
import { ArrowRight, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'

interface DryRunPair {
  ofx: {
    id: string
    description: string
    amount: number
    date: string
    type: string
    bankAccount: { name: string; bankName: string | null } | null
  }
  candidate: {
    id: string
    description: string
    amount: number
    dueDate: string
    lifecycle: string
  }
  score: number
  breakdown: { amount: number; date: number; supplier: number; description: number }
  reasoning: string[]
}

interface DryRunResponse {
  pairs: DryRunPair[]
  stats: {
    ofxScanned: number
    withMatch: number
    skipped: number
    totalValor: number
    minScore: number
  }
}

interface Props {
  empresaId: string
  open: boolean
  onClose: () => void
  onAfterBulk?: () => void
  minScore?: number
}

export function BulkDryRunModal({
  empresaId,
  open,
  onClose,
  onAfterBulk,
  minScore = 90,
}: Props) {
  const { toast } = useToast()
  const [data, setData] = useState<DryRunResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open || !empresaId) return
    setLoading(true)
    fetch(
      `/api/conciliacao/bulk-dry-run?empresaId=${empresaId}&minScore=${minScore}`,
      { credentials: 'include' },
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((d: DryRunResponse | null) => {
        setData(d)
        // Default: TODOS pré-selecionados (decisão Fase 1 — Yussef desmarca o que não quer)
        if (d) setSelected(new Set(d.pairs.map((p) => p.ofx.id)))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [open, empresaId, minScore])

  function toggle(ofxId: string) {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(ofxId)) next.delete(ofxId)
      else next.add(ofxId)
      return next
    })
  }

  function selectAll() {
    if (!data) return
    setSelected(new Set(data.pairs.map((p) => p.ofx.id)))
  }

  function unselectAll() {
    setSelected(new Set())
  }

  async function confirmar() {
    if (!data || selected.size === 0) return
    const pairs = data.pairs
      .filter((p) => selected.has(p.ofx.id))
      .map((p) => ({ ofxTransactionId: p.ofx.id, candidateId: p.candidate.id }))

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
          title: 'Falha no bulk',
          description: body.erro ?? `HTTP ${res.status}`,
        })
        return
      }
      toast({
        title: `${body.reconciled} conciliadas`,
        description:
          body.failed > 0
            ? `${body.failed} falharam — confira o histórico de erros.`
            : 'Todas aplicadas.',
      })
      onAfterBulk?.()
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const totalSelecionado = data
    ? data.pairs
        .filter((p) => selected.has(p.ofx.id))
        .reduce((acc, p) => acc + Math.abs(p.ofx.amount), 0)
    : 0

  const fmt = (d: string) => new Date(d).toLocaleDateString('pt-BR')

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Revisar conciliação em massa</DialogTitle>
          <DialogDescription>
            {loading
              ? 'Calculando pares de alta confiança...'
              : data
                ? `${data.pairs.length} par${data.pairs.length === 1 ? '' : 'es'} encontrad${data.pairs.length === 1 ? 'o' : 'os'} com score ≥ ${minScore}. Total ${formatBRL(data.stats.totalValor)}. Desmarque o que não quer aplicar.`
                : 'Nenhum dado.'}
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Buscando matches...
          </div>
        )}

        {data && data.pairs.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Nenhum par de alta confiança encontrado pra essa empresa no momento.
          </div>
        )}

        {data && data.pairs.length > 0 && (
          <>
            <div className="flex items-center gap-2 text-xs border-b pb-2">
              <button
                type="button"
                onClick={selectAll}
                className="text-primary hover:underline"
              >
                Marcar todos
              </button>
              <span className="text-muted-foreground">·</span>
              <button
                type="button"
                onClick={unselectAll}
                className="text-primary hover:underline"
              >
                Desmarcar todos
              </button>
              <span className="ml-auto text-muted-foreground">
                {selected.size} de {data.pairs.length} selecionado
                {selected.size === 1 ? '' : 's'} · Total{' '}
                {formatBRL(totalSelecionado)}
              </span>
            </div>

            <div className="overflow-y-auto flex-1 -mx-6 px-6 space-y-2">
              {data.pairs.map((p) => {
                const isOn = selected.has(p.ofx.id)
                return (
                  <div
                    key={p.ofx.id}
                    className={`border rounded-lg p-3 transition-colors ${
                      isOn ? 'bg-emerald-50/50 border-emerald-200' : 'bg-muted/30'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={isOn}
                        onCheckedChange={() => toggle(p.ofx.id)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className="bg-emerald-100 text-emerald-700 border-emerald-300 text-[10px]"
                          >
                            Score {p.score}/100
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {p.reasoning.join(' / ')}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-2">
                          <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                              Extrato (banco)
                            </p>
                            <p className="text-sm font-medium truncate">
                              {p.ofx.description}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {fmt(p.ofx.date)} ·{' '}
                              {p.ofx.bankAccount?.bankName ??
                                p.ofx.bankAccount?.name ??
                                '—'}
                            </p>
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground hidden md:block" />
                          <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                              Conta sistema
                            </p>
                            <p className="text-sm font-medium truncate">
                              {p.candidate.description}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              vence {fmt(p.candidate.dueDate)}
                            </p>
                          </div>
                        </div>
                      </div>
                      <span
                        className={`shrink-0 font-semibold text-sm tabular-nums ${
                          p.ofx.type === 'CREDIT'
                            ? 'text-emerald-600'
                            : 'text-red-600'
                        }`}
                      >
                        {p.ofx.type === 'CREDIT' ? '+' : '−'}{' '}
                        {formatBRL(p.ofx.amount)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            onClick={confirmar}
            disabled={submitting || selected.size === 0 || !data}
          >
            {submitting
              ? `Conciliando ${selected.size}...`
              : `Aplicar ${selected.size} conciliação${selected.size === 1 ? '' : 'ões'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
