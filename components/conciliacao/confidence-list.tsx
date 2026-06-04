'use client'

// Sprint A-effected Fase 2 — Lista compacta de pares OFX↔candidato.
//
// Usado nas abas "Alta confiança" (≥90) e "Revisar" (70-89).
// Cada linha: par OFX↔conta sistema com score + valor + botão "Conciliar"
// individual. Pra Alta confiança, a aba pai exibe sticky BulkApproveBar
// que processa em lote.

import { useState } from 'react'
import { ArrowRight, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'

export interface ConfidencePair {
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
  reasoning: string[]
}

interface Props {
  pairs: ConfidencePair[]
  emptyMessage: string
  onConciliated?: () => void
}

export function ConfidenceList({ pairs, emptyMessage, onConciliated }: Props) {
  const { toast } = useToast()
  const [submittingId, setSubmittingId] = useState<string | null>(null)

  async function conciliar(p: ConfidencePair) {
    setSubmittingId(p.ofx.id)
    try {
      const res = await fetch('/api/conciliacao/confirmar', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ofxTransactionId: p.ofx.id,
          candidateId: p.candidate.id,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({
          variant: 'destructive',
          title: 'Falha',
          description: body.erro ?? `HTTP ${res.status}`,
        })
        return
      }
      toast({ title: 'Conciliada', description: p.ofx.description })
      onConciliated?.()
    } finally {
      setSubmittingId(null)
    }
  }

  if (pairs.length === 0) {
    return (
      <div className="border rounded-lg bg-muted/30 py-10 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    )
  }

  const fmt = (d: string) => new Date(d).toLocaleDateString('pt-BR')

  return (
    <div className="border rounded-lg bg-card divide-y">
      {pairs.map((p) => (
        <div key={p.ofx.id} className="p-3 flex items-start gap-3">
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={
                  p.score >= 90
                    ? 'bg-emerald-100 text-emerald-700 border-emerald-300 text-[10px]'
                    : 'bg-amber-100 text-amber-700 border-amber-300 text-[10px]'
                }
              >
                Score {p.score}
              </Badge>
              {p.score >= 90 && (
                <Badge variant="secondary" className="text-[10px] bg-emerald-50 text-emerald-700">
                  <Check className="h-3 w-3 mr-1" />
                  Auto
                </Badge>
              )}
              {p.score < 90 && (
                <Badge variant="secondary" className="text-[10px] bg-amber-50 text-amber-700">
                  Confirme manualmente
                </Badge>
              )}
              <span className="text-xs text-muted-foreground truncate">
                {p.reasoning.slice(0, 3).join(' / ')}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-2">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Extrato (banco)
                </p>
                <p className="text-sm font-medium truncate">{p.ofx.description}</p>
                <p className="text-xs text-muted-foreground">
                  {fmt(p.ofx.date)}{' '}
                  {p.ofx.bankAccount &&
                    `· ${p.ofx.bankAccount.bankName ?? p.ofx.bankAccount.name}`}
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
          <div className="flex flex-col items-end gap-2 shrink-0">
            <span
              className={`font-semibold text-sm tabular-nums ${
                p.ofx.type === 'CREDIT' ? 'text-emerald-600' : 'text-red-600'
              }`}
            >
              {p.ofx.type === 'CREDIT' ? '+' : '−'} {formatBRL(p.ofx.amount)}
            </span>
            <Button
              size="sm"
              onClick={() => conciliar(p)}
              disabled={submittingId === p.ofx.id}
            >
              {submittingId === p.ofx.id ? '...' : 'Conciliar'}
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
