'use client'

// Sprint 5.0.2.q — Banner "Sugerido por IA" world-class.
//
// Inspirado em QuickBooks 2026 (raw bank data SEPARATED from AI suggestions):
// este componente é a ZONA 2 (sugestão), separada visualmente da ZONA 1
// (transação raw) por uma borda fina + fundo violeta muito sutil.
//
// Ações alinhadas à direita (Stripe pattern): Aceitar (primário) · Outra · X.

import { useState } from 'react'
import { Sparkles, Loader2, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { ConfidenceSignal } from './ConfidenceSignal'
import { SourceBadge, type SuggestionSource } from './SourceBadge'

export interface VendorSuggestion {
  transactionId: string
  cacheId: string
  logId?: string
  source: SuggestionSource
  vendorName: string
  razaoSocial?: string | null
  cnpj?: string | null
  cnaeDescricao?: string | null
  categoriaSugerida: string
  confidence: number
  description?: string
  matchedKeyword?: string
}

interface Props {
  empresaId: string
  suggestion: VendorSuggestion
  onAccepted: (categoryName: string) => void
  onRejected: () => void
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
      toast({ title: 'Sugestão aceita', description })
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

  return (
    <div className="border-t border-violet-100 bg-violet-50/40 dark:border-violet-900/40 dark:bg-violet-950/20 px-4 py-2.5">
      <div className="flex items-start gap-3">
        <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400 shrink-0 mt-0.5" />

        {/* Conteúdo central: categoria + signals */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground">
              {suggestion.categoriaSugerida}
            </span>
            <ConfidenceSignal confidence={suggestion.confidence} />
            <SourceBadge source={suggestion.source} />
          </div>

          {/* Linha contextual — razão social, CNPJ, CNAE, keyword */}
          {(suggestion.razaoSocial || suggestion.cnaeDescricao || suggestion.matchedKeyword) && (
            <div className="text-xs text-muted-foreground mt-1 truncate">
              {suggestion.razaoSocial && (
                <span>{suggestion.razaoSocial}</span>
              )}
              {suggestion.cnpj && (
                <span className="font-mono ml-1.5">· {formatCNPJ(suggestion.cnpj)}</span>
              )}
              {suggestion.cnaeDescricao && (
                <span className="ml-1.5 italic">· {suggestion.cnaeDescricao}</span>
              )}
              {suggestion.matchedKeyword && !suggestion.razaoSocial && (
                <span>
                  Palavra detectada:{' '}
                  <span className="font-mono">{suggestion.matchedKeyword}</span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Ações alinhadas direita */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="sm"
            variant="default"
            onClick={accept}
            disabled={submitting !== null}
            className="h-7 px-3 text-xs bg-violet-600 hover:bg-violet-700 text-white"
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
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            title="Rejeitar sugestão"
          >
            {submitting === 'reject' ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <X className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
