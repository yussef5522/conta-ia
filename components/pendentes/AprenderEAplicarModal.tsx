'use client'

// Modal "Aprender e aplicar" — Fase 3 Etapa 1 + Sprint UX-bulk-review.
// Aparece após user escolher categoria E houver transações similares pendentes.
// Permite aplicar a mesma categoria em N selecionadas (lista completa com
// checkbox + busca + destaque de outliers) e opcionalmente criar regra.

import { useEffect, useMemo, useState } from 'react'
import { Sparkles, Loader2, AlertCircle, Search, AlertTriangle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'
import { detectOutliers } from '@/lib/pendentes/detect-outliers'

interface SimilarItem {
  id: string
  description: string
  amount: number
  type: 'CREDIT' | 'DEBIT' | string
  date: string
  bankAccount: { name: string; bankName: string | null } | null
}

interface SimilaresResponse {
  total: number
  totalAmount: number
  tipoMatch: 'EXACT' | 'NORMALIZED' | 'STEM'
  padrao: string
  preview: Array<{ id: string; description: string; amount: number; type: string; date: string }>
  items: SimilarItem[]
  itemsCap: number
  itemsTruncated: boolean
}

interface BaseSnapshot {
  id: string
  description: string
}

interface CategoriaSnapshot {
  id: string
  name: string
}

// Fase 3 Etapa 3: contexto opcional de sugestão Claude.
export interface ClaudeContext {
  cacheKey: string
  suggestedCategoryId: string | null
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  base: BaseSnapshot | null
  categoria: CategoriaSnapshot | null
  claudeContext?: ClaudeContext | null
  onApplied: (result: { affectedTxIds: string[]; total: number }) => void
}

export function AprenderEAplicarModal({
  open,
  onOpenChange,
  base,
  categoria,
  claudeContext,
  onApplied,
}: Props) {
  const { toast } = useToast()
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [similares, setSimilares] = useState<SimilaresResponse | null>(null)
  const [learnPattern, setLearnPattern] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!open || !base) return
    setErro(null)
    setSimilares(null)
    setLearnPattern(true)
    setSearch('')
    setSelectedIds(new Set())
    setLoadingPreview(true)
    fetch(`/api/transacoes/${base.id}/similares`)
      .then((r) => r.json())
      .then((data) => {
        if (data.erro) {
          setErro(data.erro)
          return
        }
        setSimilares(data)
        // Default: todas marcadas
        setSelectedIds(new Set((data.items ?? []).map((it: SimilarItem) => it.id)))
      })
      .catch(() => setErro('Erro ao buscar transações similares.'))
      .finally(() => setLoadingPreview(false))
  }, [open, base])

  const items: SimilarItem[] = similares?.items ?? []
  const outlierIds = useMemo(() => detectOutliers(items), [items])

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return items
    return items.filter(
      (it) =>
        it.description.toLowerCase().includes(term) ||
        formatBRL(it.amount).toLowerCase().includes(term) ||
        (it.bankAccount?.name ?? '').toLowerCase().includes(term),
    )
  }, [items, search])

  const selectedCount = selectedIds.size
  const selectedAmount = useMemo(
    () =>
      items
        .filter((it) => selectedIds.has(it.id))
        .reduce((s, it) => s + Math.abs(it.amount), 0),
    [items, selectedIds],
  )

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function markAllVisible() {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const it of filteredItems) next.add(it.id)
      return next
    })
  }

  function unmarkAllVisible() {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const it of filteredItems) next.delete(it.id)
      return next
    })
  }

  async function aplicar(applyToSimilar: boolean) {
    if (!base || !categoria) return
    setSubmitting(true)
    setErro(null)
    try {
      const explicitIds = applyToSimilar ? Array.from(selectedIds) : undefined
      const res = await fetch(
        `/api/transacoes/${base.id}/classificar-com-aprendizado`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            categoryId: categoria.id,
            learnPattern,
            applyToSimilar,
            ...(explicitIds ? { similarTxIds: explicitIds } : {}),
            ...(claudeContext
              ? {
                  claudeCacheKey: claudeContext.cacheKey,
                  claudeSuggestedCategoryId: claudeContext.suggestedCategoryId,
                }
              : {}),
          }),
        },
      )
      const data = await res.json()
      if (!res.ok) {
        setErro(data.erro ?? 'Falha ao aplicar classificação')
        return
      }
      const similarApplied = data.similarApplied ?? 0
      const vm: { anchor: string | null; retroactiveCount: number } | undefined =
        data.vendorMemory
      const totalAffected = 1 + similarApplied + (vm?.retroactiveCount ?? 0)
      onApplied({
        affectedTxIds: applyToSimilar
          ? [base.id, ...Array.from(selectedIds)]
          : [base.id],
        total: totalAffected,
      })

      const ruleMsg = data.ruleId
        ? data.ruleCreated
          ? 'Regra aprendida 🤖'
          : 'Regra reforçada 🤖'
        : ''
      const vmMsg =
        vm && vm.anchor && vm.retroactiveCount > 0
          ? `+${vm.retroactiveCount} ${vm.anchor} categorizadas automaticamente`
          : vm && vm.anchor
            ? `Próximas com "${vm.anchor}" serão categorizadas automaticamente`
            : ''
      const description = [ruleMsg, vmMsg].filter(Boolean).join(' · ')

      if (applyToSimilar && similarApplied > 0) {
        toast({
          variant: 'success',
          title: `${totalAffected} classificadas como ${categoria.name}`,
          description: description || `Aplicado em ${similarApplied} similares.`,
        })
      } else {
        toast({
          variant: 'success',
          title: `Classificada como ${categoria.name}`,
          description: description || 'Sem similares pendentes.',
        })
      }
      onOpenChange(false)
    } catch {
      setErro('Erro de rede. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!base || !categoria) return null

  const total = similares?.total ?? 0
  const hasSimilares = total > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl w-[calc(100vw-2rem)] max-h-[90vh] flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {hasSimilares
              ? `Encontrei ${total} transações similares`
              : 'Classificar transação'}
          </DialogTitle>
          <DialogDescription>
            Categoria escolhida: <strong>{categoria.name}</strong>
          </DialogDescription>
        </DialogHeader>

        {/* Base sample (sempre visível) */}
        <div className="rounded-md border bg-muted/30 p-3 text-sm shrink-0">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            Transação selecionada
          </p>
          <p className="font-medium break-words mt-0.5">{base.description}</p>
        </div>

        {loadingPreview ? (
          <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Buscando padrões similares...
          </div>
        ) : erro ? (
          <div className="flex items-start gap-2 rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <p>{erro}</p>
          </div>
        ) : hasSimilares ? (
          <div className="flex flex-col gap-3 min-h-0 flex-1">
            {/* Resumo no topo (sticky-like) */}
            <div className="rounded-md border p-3 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="text-sm">
                <strong className="text-foreground">{selectedCount}</strong>
                <span className="text-muted-foreground"> de {total} marcadas</span>
                <span className="text-muted-foreground"> · </span>
                <strong className="text-foreground tabular-nums">
                  {formatBRL(selectedAmount)}
                </strong>
                {outlierIds.size > 0 && (
                  <span className="ml-2 inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="h-3 w-3" />
                    {outlierIds.size} fora do padrão
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={markAllVisible}>
                  Marcar visíveis
                </Button>
                <Button size="sm" variant="ghost" onClick={unmarkAllVisible}>
                  Desmarcar visíveis
                </Button>
              </div>
            </div>

            {/* Busca/filtro */}
            <div className="relative shrink-0">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filtrar por nome, valor ou conta..."
                className="pl-8 h-9 text-sm"
              />
            </div>

            {/* Lista completa scrollable */}
            <div className="border rounded-md flex-1 min-h-0 overflow-y-auto divide-y">
              {filteredItems.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Nenhuma transação bate o filtro.
                </div>
              ) : (
                filteredItems.map((it) => {
                  const isSel = selectedIds.has(it.id)
                  const isOutlier = outlierIds.has(it.id)
                  const date = new Date(it.date).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                  })
                  const bankLabel = it.bankAccount
                    ? it.bankAccount.bankName ?? it.bankAccount.name
                    : '—'
                  return (
                    <label
                      key={it.id}
                      className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/40 transition-colors ${
                        isOutlier
                          ? 'bg-amber-50/40 dark:bg-amber-950/20'
                          : ''
                      } ${!isSel ? 'opacity-50' : ''}`}
                    >
                      <Checkbox
                        checked={isSel}
                        onCheckedChange={() => toggleOne(it.id)}
                        className="shrink-0"
                      />
                      <span className="text-xs text-muted-foreground tabular-nums shrink-0 w-10">
                        {date}
                      </span>
                      <span
                        className="text-sm flex-1 min-w-0 break-words"
                        title={it.description}
                      >
                        {it.description}
                        {isOutlier && (
                          <span
                            className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] text-amber-700 dark:text-amber-400 align-middle"
                            title="Descrição diferente do padrão dominante — confira antes de aplicar"
                          >
                            <AlertTriangle className="h-2.5 w-2.5" />
                            fora do padrão
                          </span>
                        )}
                      </span>
                      <span className="text-[10px] text-muted-foreground shrink-0 truncate max-w-[80px]">
                        {bankLabel}
                      </span>
                      <span
                        className={`text-sm tabular-nums shrink-0 w-24 text-right ${
                          it.type === 'CREDIT'
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}
                      >
                        {it.type === 'CREDIT' ? '+' : '−'} {formatBRL(it.amount)}
                      </span>
                    </label>
                  )
                })
              )}
            </div>

            {similares?.itemsTruncated && (
              <div className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1 shrink-0">
                <AlertTriangle className="h-3 w-3" />
                Mostrando primeiras {similares.itemsCap} de {total}. Refine o
                padrão pra cobrir as restantes em outra aplicação.
              </div>
            )}

            {/* Toggle aprender padrão */}
            <label className="flex items-start gap-2.5 cursor-pointer rounded-md border p-3 hover:bg-muted/40 transition-colors shrink-0">
              <Checkbox
                checked={learnPattern}
                onCheckedChange={(v) => setLearnPattern(v === true)}
                className="mt-0.5"
              />
              <div className="text-sm space-y-0.5">
                <p className="font-medium">
                  Aprender este padrão (aplicar automaticamente em importações futuras)
                </p>
                <p className="text-xs text-muted-foreground">
                  Sistema cria uma regra com base nas selecionadas. Novos imports
                  com o mesmo padrão entram já classificados.
                </p>
              </div>
            </label>
          </div>
        ) : (
          <div className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground break-words">
            Nenhuma transação similar pendente. Só esta vai ser classificada.{' '}
            {learnPattern && 'Uma regra será criada pra próximos imports.'}
          </div>
        )}

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end shrink-0">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          {hasSimilares && (
            <Button
              type="button"
              variant="outline"
              onClick={() => aplicar(false)}
              disabled={submitting}
            >
              Só esta
            </Button>
          )}
          <Button
            type="button"
            onClick={() => aplicar(hasSimilares)}
            disabled={submitting || (hasSimilares && selectedCount === 0)}
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />}
            {hasSimilares
              ? `Aplicar nas ${1 + selectedCount} selecionadas`
              : learnPattern
                ? 'Aplicar e aprender'
                : 'Aplicar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
