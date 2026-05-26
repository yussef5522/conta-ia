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

const SOURCE_LABEL: Record<PreviewTransacao['source'], string> = {
  SAME_COMPANY_TRANSFER: 'Transferência interna',
  PIX_DETECTION: 'Pix sócio/grupo',
  RULE_EXACT_NORMALIZED: 'Regra aprendida',
  RULE_CONTAINS: 'Memória anchor',
  SETOR_PATTERN: 'Padrão setorial',
}

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Auto-categorizar pendentes
          </DialogTitle>
          <DialogDescription>
            Revise as sugestões antes de aplicar. Você pode desmarcar
            individualmente ou rejeitar grupos inteiros.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 -mx-6 px-6">
          {!data ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-3">
              {/* Resumo */}
              <div className="rounded-md border bg-primary/5 px-3 py-2 text-sm">
                <p className="font-semibold">
                  📊 {data.totalSugeridas} de {data.totalAnalisadas} pendentes com sugestão
                  {data.setor && (
                    <span className="text-xs text-muted-foreground ml-2 font-normal">
                      (setor: {data.setor})
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Transf. interna: <strong>{data.breakdown.sameCompany}</strong> ·
                  Pix: <strong>{data.breakdown.pix}</strong> ·
                  Regras: <strong>{data.breakdown.ruleExact + data.breakdown.ruleContains}</strong> ·
                  Setor: <strong>{data.breakdown.setorPattern}</strong>
                  {data.semSugestao > 0 && (
                    <>
                      {' · '}
                      <span className="text-amber-600">
                        Sem sugestão: <strong>{data.semSugestao}</strong>
                      </span>
                    </>
                  )}
                </p>
              </div>

              {/* Grupos por categoria */}
              {data.resumoPorCategoria.length === 0 && (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  Nenhuma sugestão. Categorize manualmente as pendentes.
                </div>
              )}

              {data.resumoPorCategoria.map((grupo) => {
                const isOpen = expanded.has(grupo.categoryId)
                const grupoAceitos = grupo.transacoes.filter(
                  (t) => !rejected.has(t.transactionId),
                ).length
                return (
                  <div
                    key={grupo.categoryId}
                    className="border rounded-md overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => toggleGroup(grupo.categoryId)}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/30 text-left"
                    >
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4 shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0" />
                      )}
                      <span className="font-semibold flex-1 truncate">
                        {grupo.categoryName}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                        {grupoAceitos}/{grupo.count} · {formatBRL(grupo.totalAmount)}
                      </span>
                    </button>
                    {isOpen && (
                      <div className="border-t bg-muted/10">
                        <div className="px-3 py-1.5 flex gap-2 border-b">
                          <button
                            type="button"
                            onClick={() => acceptGroup(grupo)}
                            className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline"
                          >
                            Aceitar todas
                          </button>
                          <span className="text-xs text-muted-foreground">·</span>
                          <button
                            type="button"
                            onClick={() => rejectGroup(grupo)}
                            className="text-xs text-destructive hover:underline"
                          >
                            Rejeitar todas
                          </button>
                        </div>
                        <ul className="divide-y">
                          {grupo.transacoes.map((tx) => {
                            const aceito = !rejected.has(tx.transactionId)
                            return (
                              <li
                                key={tx.transactionId}
                                className={`flex items-center gap-2 px-3 py-1.5 text-xs ${
                                  aceito ? '' : 'opacity-50 line-through'
                                }`}
                              >
                                <Checkbox
                                  checked={aceito}
                                  onCheckedChange={() => toggleTx(tx.transactionId)}
                                  aria-label="Aceitar sugestão"
                                />
                                <span className="flex-1 truncate" title={tx.description}>
                                  {tx.description}
                                </span>
                                <span
                                  className={`tabular-nums shrink-0 ${
                                    tx.type === 'CREDIT' ? 'text-emerald-600' : 'text-red-600'
                                  }`}
                                >
                                  {tx.type === 'CREDIT' ? '+' : '−'} {formatBRL(tx.amount)}
                                </span>
                                <span className="text-[10px] uppercase rounded bg-muted px-1.5 py-0.5 shrink-0">
                                  {SOURCE_LABEL[tx.source]}
                                </span>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-3 -mb-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={applying}>
            <X className="h-4 w-4 mr-1" />
            Cancelar
          </Button>
          <Button onClick={aplicar} disabled={applying || acceptedCount === 0}>
            {applying ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Sparkles className="h-4 w-4 mr-1" />
            )}
            Aplicar {acceptedCount} categorizações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
