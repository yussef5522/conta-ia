'use client'

// Sprint 5.0.2.n — Banner "Sugerido por IA" pra Vendor Discovery.
// NUNCA auto-aplica: user clica Aceitar ou Rejeitar.

import { useState } from 'react'
import { Sparkles, Loader2, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'

export interface VendorSuggestion {
  transactionId: string
  cacheId: string
  logId?: string
  source: 'CACHE_GLOBAL' | 'BRASIL_API' | 'CLAUDE_AI'
  vendorName: string
  razaoSocial?: string | null
  cnpj?: string | null
  cnaeDescricao?: string | null
  categoriaSugerida: string
  confidence: number
  description?: string
}

interface Props {
  empresaId: string
  suggestion: VendorSuggestion
  onAccepted: (categoryName: string) => void
  onRejected: () => void
}

const SOURCE_LABEL: Record<VendorSuggestion['source'], string> = {
  CACHE_GLOBAL: 'Conhecido',
  BRASIL_API: 'Receita Federal',
  CLAUDE_AI: 'IA',
}

function formatCNPJ(cnpj: string): string {
  const n = cnpj.replace(/\D/g, '')
  if (n.length !== 14) return cnpj
  return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5, 8)}/${n.slice(8, 12)}-${n.slice(12)}`
}

export function VendorSuggestionBanner({
  empresaId,
  suggestion,
  onAccepted,
  onRejected,
}: Props) {
  const { toast } = useToast()
  const [submitting, setSubmitting] = useState<'accept' | 'reject' | null>(null)

  async function accept() {
    setSubmitting('accept')
    try {
      const res = await fetch(
        `/api/empresas/${empresaId}/vendor-discovery/accept`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transactionId: suggestion.transactionId,
            cacheId: suggestion.cacheId,
            categoryName: suggestion.categoriaSugerida,
            ...(suggestion.logId ? { logId: suggestion.logId } : {}),
          }),
        },
      )
      const data = await res.json()
      if (!res.ok) {
        toast({
          variant: 'destructive',
          title: 'Falha ao aceitar sugestão',
          description: data.erro ?? `HTTP ${res.status}`,
        })
        return
      }
      const vm = data.vendorMemory
      const description =
        vm?.anchor && vm.retroactiveCount > 0
          ? `+${vm.retroactiveCount} ${vm.anchor} categorizadas automaticamente`
          : `Categorizada como ${data.categoryName}`
      toast({ title: '✓ Sugestão aceita', description })
      onAccepted(suggestion.categoriaSugerida)
    } catch {
      toast({ variant: 'destructive', title: 'Erro de rede' })
    } finally {
      setSubmitting(null)
    }
  }

  async function reject() {
    setSubmitting('reject')
    try {
      const res = await fetch(
        `/api/empresas/${empresaId}/vendor-discovery/reject`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transactionId: suggestion.transactionId,
            cacheId: suggestion.cacheId,
            ...(suggestion.logId ? { logId: suggestion.logId } : {}),
          }),
        },
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast({
          variant: 'destructive',
          title: 'Falha ao rejeitar',
          description: data.erro ?? `HTTP ${res.status}`,
        })
        return
      }
      onRejected()
    } catch {
      toast({ variant: 'destructive', title: 'Erro de rede' })
    } finally {
      setSubmitting(null)
    }
  }

  const highConfidence = suggestion.confidence >= 0.85

  return (
    <div className="rounded-md border border-purple-500/30 bg-purple-500/5 px-3 py-2 mt-2">
      <div className="flex items-start gap-2">
        <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">
              Sugerido por IA
            </span>
            <span className="text-[10px] uppercase tracking-wide rounded bg-purple-500/10 px-1.5 py-0.5 text-purple-700 dark:text-purple-300">
              {SOURCE_LABEL[suggestion.source]}
            </span>
            <span
              className={
                'text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 ' +
                (highConfidence
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-400')
              }
            >
              {highConfidence ? 'Alta confiança' : `${Math.round(suggestion.confidence * 100)}%`}
            </span>
          </div>
          {suggestion.razaoSocial && (
            <p className="text-xs text-muted-foreground mt-1 truncate">
              📋 {suggestion.razaoSocial}
              {suggestion.cnpj && ` · ${formatCNPJ(suggestion.cnpj)}`}
            </p>
          )}
          {suggestion.cnaeDescricao && (
            <p className="text-[11px] text-muted-foreground italic truncate">
              {suggestion.cnaeDescricao}
            </p>
          )}
          <p className="text-sm mt-1">
            Categoria sugerida: <strong>{suggestion.categoriaSugerida}</strong>
          </p>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button
            size="sm"
            variant="default"
            onClick={accept}
            disabled={submitting !== null}
            className="h-7 px-2 text-xs"
          >
            {submitting === 'accept' ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <>
                <Check className="h-3 w-3 mr-1" />
                Aceitar
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={reject}
            disabled={submitting !== null}
            className="h-7 px-2 text-xs"
          >
            {submitting === 'reject' ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <X className="h-3 w-3" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
