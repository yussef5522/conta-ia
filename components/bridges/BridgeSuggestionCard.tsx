// Sprint PF Fatia 4 — Card de sugestão de ponte (aparece em /pendentes).
// 1 clique cria a ponte com os defaults vindos da detecção.

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { KIND_DEFAULTS } from '@/lib/bridges/kind-defaults'
import type { BridgeKind } from '@/lib/bridges/types'

interface SuggestionItem {
  pjTransactionId: string
  pjDescription: string
  pjAmount: number
  pjDate: string
  profileId: string
  profileName: string
  socioPFId: string
  socioPFNome: string
  suggestedKind: BridgeKind
  suggestedAccountId: string | null
  suggestedCategoryId: string | null
}

interface Props {
  companyId: string
  /** Nome da empresa atual pra exibir no card */
  pjCompanyName: string
  suggestion: SuggestionItem
  onConfirmed?: () => void
  /** Rota pra criação manual quando user quer ajustar o tipo */
  formHref: string
}

export function BridgeSuggestionCard({
  companyId, pjCompanyName, suggestion, onConfirmed, formHref,
}: Props) {
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()
  const defaults = KIND_DEFAULTS[suggestion.suggestedKind]

  const canQuickConfirm = !!suggestion.suggestedAccountId && !!suggestion.suggestedCategoryId

  async function handleQuickConfirm() {
    if (!canQuickConfirm) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/pontes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          companyId,
          pjTransactionId: suggestion.pjTransactionId,
          profileId: suggestion.profileId,
          pfBankAccountId: suggestion.suggestedAccountId!,
          pfCategoryId: suggestion.suggestedCategoryId!,
          kind: suggestion.suggestedKind,
          createdVia: 'CREATED_FROM_DETECTION',
          socioPFId: suggestion.socioPFId,
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.erro ?? 'Erro ao criar ponte')
      }
      toast({
        title: '🌉 Ponte criada',
        description: `R$ ${suggestion.pjAmount.toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
        })} entrou no perfil ${suggestion.profileName}`,
      })
      onConfirmed?.()
    } catch (err) {
      toast({
        title: 'Erro',
        description: (err as Error).message,
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const dateFormatted = new Date(suggestion.pjDate).toLocaleDateString('pt-BR')

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
      <div className="mb-2 text-sm text-slate-700">
        <strong>{dateFormatted}</strong> · {pjCompanyName}
      </div>
      <div className="mb-3 text-sm text-slate-700">
        −R${' '}
        {suggestion.pjAmount.toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
        })}{' '}
        · {suggestion.pjDescription}
      </div>
      <div className="mb-3 rounded border border-primary/30 bg-white p-2">
        <p className="text-sm text-slate-800">
          🎯 Vai pro perfil{' '}
          <strong className="text-slate-900">{suggestion.profileName}</strong>
        </p>
        <p className="mt-1 text-xs text-slate-600">
          Tipo sugerido: {defaults.emoji} <strong>{defaults.label}</strong> ·{' '}
          {defaults.affectsDre ? 'afeta DRE' : 'fora do DRE'}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={handleQuickConfirm}
          disabled={submitting || !canQuickConfirm}
        >
          {submitting ? 'Criando…' : '🌉 Confirmar ponte'}
        </Button>
        <Link href={formHref}>
          <Button size="sm" variant="outline">
            Outro tipo
          </Button>
        </Link>
      </div>
      {!canQuickConfirm && (
        <p className="mt-2 text-xs text-amber-700">
          ⚠ Perfil PF sem conta/categoria default — clique &quot;Outro tipo&quot;
          pra ajustar.
        </p>
      )}
    </div>
  )
}
