'use client'

// Sprint 5.0.2.p — Modal de preview do "Auto-categorizar tudo".
// Mostra plano agrupado por categoria, user aceita/rejeita por linha,
// confirma → aplica em batch.

import { useMemo, useState } from 'react'
import { Loader2, Sparkles, X, ChevronDown, ChevronRight } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'
import { ConfidenceSignal } from './ConfidenceSignal'
import { SourceBadge } from './SourceBadge'

export interface PreviewTransacao {
  transactionId: string
  description: string
  amount: number
  type: string
  date: string | Date
  bankAccountId: string | null
  categoryId: string
  categoryName: string
  source:
    | 'SAME_COMPANY_TRANSFER'
    | 'PIX_DETECTION'
    | 'RULE_EXACT_NORMALIZED'
    | 'RULE_CONTAINS'
    | 'SETOR_PATTERN'
  confidence: number
  linkedTransactionId?: string
  relatedPartyType?: string
  relatedPartyId?: string
}

export interface PreviewGrupo {
  categoryId: string
  categoryName: string
  count: number
  totalAmount: number
  transacoes: PreviewTransacao[]
}

export interface PreviewData {
  setor: string | null
  totalAnalisadas: number
  totalSugeridas: number
  semSugestao: number
  breakdown: {
    sameCompany: number
    pix: number
    ruleExact: number
    ruleContains: number
    setorPattern: number
  }
  resumoPorCategoria: PreviewGrupo[]
}

// Sprint 5.0.2.q — SOURCE_LABEL movido pra components/SourceBadge.tsx

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  empresaId: string
  data: PreviewData | null
  onApplied: (aplicadas: number) => void
}

export function AutoCategorizePreviewModal({
  open,
  onOpenChange,
  empresaId,
  data,
  onApplied,
}: Props) {
  const { toast } = useToast()
  const [applying, setApplying] = useState(false)
  /** IDs REJEITADOS — o resto é aceito por default. */
  const [rejected, setRejected] = useState<Set<string>>(new Set())
  /** Grupos expandidos */
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const acceptedCount = useMemo(() => {
    if (!data) return 0
    return data.resumoPorCategoria.reduce(
      (acc, g) =>
        acc + g.transacoes.filter((t) => !rejected.has(t.transactionId)).length,
      0,
    )
  }, [data, rejected])

  function toggleGroup(catId: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(catId)) next.delete(catId)
      else next.add(catId)
      return next
    })
  }

  function toggleTx(txId: string) {
    setRejected((prev) => {
      const next = new Set(prev)
      if (next.has(txId)) next.delete(txId)
      else next.add(txId)
      return next
    })
  }

  function rejectGroup(grupo: PreviewGrupo) {
    setRejected((prev) => {
      const next = new Set(prev)
      for (const t of grupo.transacoes) next.add(t.transactionId)
      return next
    })
  }

  function acceptGroup(grupo: PreviewGrupo) {
    setRejected((prev) => {
      const next = new Set(prev)
      for (const t of grupo.transacoes) next.delete(t.transactionId)
      return next
    })
  }

  async function aplicar() {
    if (!data || applying) return
    setApplying(true)
    try {
      const items: Array<Record<string, unknown>> = []
      for (const grupo of data.resumoPorCategoria) {
        for (const tx of grupo.transacoes) {
          if (rejected.has(tx.transactionId)) continue
          items.push({
            transactionId: tx.transactionId,
            categoryId: tx.categoryId,
            source: tx.source,
            ...(tx.linkedTransactionId ? { linkedTransactionId: tx.linkedTransactionId } : {}),
            ...(tx.relatedPartyType ? { relatedPartyType: tx.relatedPartyType } : {}),
            ...(tx.relatedPartyId ? { relatedPartyId: tx.relatedPartyId } : {}),
          })
        }
      }

      if (items.length === 0) {
        toast({
          variant: 'destructive',
          title: 'Nenhuma sugestão selecionada',
          description: 'Aceite pelo menos uma pra aplicar.',
        })
        return
      }

      const res = await fetch(
        `/api/empresas/${empresaId}/auto-categorize-all/apply`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items }),
        },
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast({
          variant: 'destructive',
          title: 'Falha ao aplicar',
          description: err.erro ?? `HTTP ${res.status}`,
        })
        return
      }
      const result = await res.json()
      toast({
        title: `✓ ${result.aplicadas} transações categorizadas`,
        description: `${data.resumoPorCategoria.length} categorias diferentes`,
      })
      onApplied(result.aplicadas)
      onOpenChange(false)
    } catch {
      toast({ variant: 'destructive', title: 'Erro de rede' })
    } finally {
      setApplying(false)
    }
  }

  // Total a categorizar (R$) — só somando aceitas
  const totalAmountAceitas = useMemo(() => {
    if (!data) return 0
    let total = 0
    for (const g of data.resumoPorCategoria) {
      for (const t of g.transacoes) {
        if (!rejected.has(t.transactionId)) total += t.amount
      }
    }
    return total
  }, [data, rejected])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col p-0">
        {/* Header compacto, padrão Stripe */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-violet-600" />
            Auto-categorização
          </DialogTitle>
          <DialogDescription>
            Confira as sugestões antes de aplicar — pode desmarcar individualmente
            ou rejeitar grupos.
          </DialogDescription>
        </DialogHeader>

        {/* Stat cards */}
        {data && (
          <div className="grid grid-cols-3 gap-3 px-6 py-4 border-b bg-muted/10">
            <div className="rounded-md border bg-card px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                Com sugestão
              </p>
              <p className="text-xl font-semibold tabular-nums mt-0.5">
                {data.totalSugeridas}
                <span className="text-sm text-muted-foreground font-normal ml-1">
                  / {data.totalAnalisadas}
                </span>
              </p>
            </div>
            <div className="rounded-md border bg-card px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                Total selecionado
              </p>
              <p className="text-xl font-semibold tabular-nums mt-0.5 text-foreground">
                {formatBRL(totalAmountAceitas)}
              </p>
            </div>
            <div className="rounded-md border bg-card px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                Sem sugestão
              </p>
              <p
                className={`text-xl font-semibold tabular-nums mt-0.5 ${
                  data.semSugestao > 0 ? 'text-amber-600 dark:text-amber-400' : ''
                }`}
              >
                {data.semSugestao}
              </p>
            </div>
          </div>
        )}

        {/* Lista de grupos */}
        <div className="overflow-y-auto flex-1">
          {!data ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : data.resumoPorCategoria.length === 0 ? (
            <div className="text-center py-16 text-sm text-muted-foreground">
              Nenhuma sugestão. Categorize manualmente as pendentes.
            </div>
          ) : (
            <div>
              {data.resumoPorCategoria.map((grupo) => {
                const isOpen = expanded.has(grupo.categoryId)
                const grupoAceitos = grupo.transacoes.filter(
                  (t) => !rejected.has(t.transactionId),
                ).length
                return (
                  <div
                    key={grupo.categoryId}
                    className="border-b last:border-0"
                  >
                    <button
                      type="button"
                      onClick={() => toggleGroup(grupo.categoryId)}
                      className="w-full flex items-center gap-3 px-6 py-3 hover:bg-muted/30 text-left transition-colors"
                    >
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {grupo.categoryName}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                          {grupoAceitos}/{grupo.count} aceitas
                        </p>
                      </div>
                      <span className="text-sm font-mono tabular-nums text-foreground shrink-0">
                        {formatBRL(grupo.totalAmount)}
                      </span>
                      <div
                        className="flex items-center gap-2 shrink-0 ml-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => acceptGroup(grupo)}
                          className="text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                        >
                          Aceitar todas
                        </button>
                        <span className="text-muted-foreground">·</span>
                        <button
                          type="button"
                          onClick={() => rejectGroup(grupo)}
                          className="text-xs font-medium text-muted-foreground hover:text-foreground"
                        >
                          Rejeitar
                        </button>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="bg-muted/10 border-t">
                        {grupo.transacoes.map((tx) => {
                          const aceito = !rejected.has(tx.transactionId)
                          return (
                            <div
                              key={tx.transactionId}
                              className={`flex items-center gap-3 px-6 py-2.5 hover:bg-background transition-colors ${
                                aceito ? '' : 'opacity-50'
                              }`}
                            >
                              <Checkbox
                                checked={aceito}
                                onCheckedChange={() => toggleTx(tx.transactionId)}
                                aria-label="Aceitar sugestão"
                              />
                              <div className="flex-1 min-w-0">
                                <p
                                  className={`text-sm font-medium truncate ${
                                    aceito ? 'text-foreground' : 'line-through'
                                  }`}
                                  title={tx.description}
                                >
                                  {tx.description}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <ConfidenceSignal
                                    confidence={tx.confidence}
                                    compact
                                  />
                                  <SourceBadge source={tx.source} />
                                </div>
                              </div>
                              <span
                                className={`font-mono text-sm tabular-nums shrink-0 ${
                                  tx.type === 'CREDIT'
                                    ? 'text-emerald-600'
                                    : 'text-red-600'
                                }`}
                              >
                                {tx.type === 'CREDIT' ? '+' : '−'} {formatBRL(tx.amount)}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer fixo */}
        <DialogFooter className="border-t bg-background px-6 py-3 sm:flex-row sm:justify-between">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground tabular-nums">{acceptedCount}</strong>{' '}
            {acceptedCount === 1 ? 'sugestão será aplicada' : 'sugestões serão aplicadas'}
          </p>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={applying}
            >
              <X className="h-4 w-4 mr-1" />
              Cancelar
            </Button>
            <Button
              onClick={aplicar}
              disabled={applying || acceptedCount === 0}
            >
              {applying ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Sparkles className="h-4 w-4 mr-1" />
              )}
              Aplicar {acceptedCount}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
