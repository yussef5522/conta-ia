'use client'

// Modal "Aprender e aplicar" — Fase 3 Etapa 1.
// Aparece após user escolher categoria E houver transações similares pendentes.
// Permite aplicar a mesma categoria em todas as similares com 1 click + criar
// regra pra próximos imports.

import { useEffect, useState } from 'react'
import { Sparkles, Loader2, AlertCircle } from 'lucide-react'
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
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'

interface SimilarPreview {
  id: string
  description: string
  amount: number
  type: 'CREDIT' | 'DEBIT' | string
  date: string
}

interface SimilaresResponse {
  total: number
  totalAmount: number
  tipoMatch: 'EXACT' | 'NORMALIZED'
  padrao: string
  preview: SimilarPreview[]
}

interface BaseSnapshot {
  id: string
  description: string
}

interface CategoriaSnapshot {
  id: string
  name: string
}

// Fase 3 Etapa 3: contexto opcional de sugestão Claude que originou esta
// classificação. Se passado E categoria final !== claudeSuggestedCategoryId,
// o backend invalida o cache do Claude.
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

  useEffect(() => {
    if (!open || !base) return
    setErro(null)
    setSimilares(null)
    setLearnPattern(true)
    setLoadingPreview(true)
    fetch(`/api/transacoes/${base.id}/similares`)
      .then((r) => r.json())
      .then((data) => {
        if (data.erro) {
          setErro(data.erro)
          return
        }
        setSimilares(data)
      })
      .catch(() => setErro('Erro ao buscar transações similares.'))
      .finally(() => setLoadingPreview(false))
  }, [open, base])

  async function aplicar(applyToSimilar: boolean) {
    if (!base || !categoria) return
    setSubmitting(true)
    setErro(null)
    try {
      const res = await fetch(
        `/api/transacoes/${base.id}/classificar-com-aprendizado`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            categoryId: categoria.id,
            learnPattern,
            applyToSimilar,
            // Fase 3 Etapa 3: contexto Claude (invalidação de cache em override)
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
      // Sprint 5.0.2.m — Vendor Memory adicional via anchor word
      const vm: { anchor: string | null; retroactiveCount: number } | undefined =
        data.vendorMemory
      const totalAffected = 1 + similarApplied + (vm?.retroactiveCount ?? 0)
      const affected = [base.id, ...(similares?.preview ?? []).map((p) => p.id)]
      onApplied({
        affectedTxIds: applyToSimilar
          ? [base.id, ...(similares?.preview ?? []).map((p) => p.id)]
          : [base.id],
        total: totalAffected,
      })

      const ruleMsg = data.ruleId
        ? data.ruleCreated
          ? 'Regra aprendida 🤖'
          : 'Regra reforçada 🤖'
        : ''
      // Sprint 5.0.2.m — descrição inclui vendor memory quando aplicável
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
      void affected
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
      <DialogContent className="sm:max-w-lg">
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

        {/* Base sample */}
        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            Transação selecionada
          </p>
          <p className="font-medium truncate mt-0.5">{base.description}</p>
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
          <>
            <div className="rounded-md border p-3 space-y-2">
              <p className="text-xs text-muted-foreground">
                <strong>{total}</strong> transações com mesmo padrão
                ·{' '}
                <strong className="text-foreground">
                  {formatBRL(similares?.totalAmount ?? 0)}
                </strong>{' '}
                acumulado
              </p>
              <ul className="space-y-1.5 max-h-[200px] overflow-y-auto">
                {(similares?.preview ?? []).map((p) => (
                  <li key={p.id} className="text-xs flex items-center justify-between gap-2">
                    <span className="truncate flex-1">{p.description}</span>
                    <span className={`tabular-nums shrink-0 ${p.type === 'CREDIT' ? 'text-green-600' : 'text-red-600'}`}>
                      {p.type === 'CREDIT' ? '+' : '−'} {formatBRL(p.amount)}
                    </span>
                  </li>
                ))}
                {total > 5 && (
                  <li className="text-xs text-muted-foreground italic">
                    + {total - 5} outras transações
                  </li>
                )}
              </ul>
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer rounded-md border p-3 hover:bg-muted/40 transition-colors">
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
                  Sistema cria uma regra. Novos imports com o mesmo padrão entram já classificados.
                </p>
              </div>
            </label>
          </>
        ) : (
          <div className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
            Nenhuma transação similar pendente. Só esta vai ser classificada.
            {' '}
            {learnPattern && 'Uma regra será criada pra próximos imports.'}
          </div>
        )}

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
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
            disabled={submitting}
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />}
            {hasSimilares
              ? `Aplicar em ${1 + total}`
              : learnPattern
                ? 'Aplicar e aprender'
                : 'Aplicar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
