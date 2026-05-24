'use client'

// Sprint 4.0.2 — Card visual de match OFX ↔ PAYABLE/RECEIVABLE.
// Mostra os 2 lados + score + breakdown + razões + checkbox + botões.

import { ArrowRight, Check, X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { formatBRL } from '@/lib/format/money'

interface OFX {
  id: string
  description: string
  amount: number
  date: Date | string
  type: string
}

interface Candidate {
  id: string
  description: string
  amount: number
  dueDate: Date | string | null
  lifecycle: string
}

interface Props {
  ofx: OFX
  candidate: Candidate
  score: number
  reasoning: string[]
  selected: boolean
  onToggle: () => void
  recommendation: 'AUTO_RECONCILE' | 'CONFIRM' | 'NO_MATCH'
}

export function MatchCard({
  ofx,
  candidate,
  score,
  reasoning,
  selected,
  onToggle,
  recommendation,
}: Props) {
  const scoreColor =
    score >= 90
      ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
      : score >= 70
        ? 'bg-amber-100 text-amber-700 border-amber-300'
        : 'bg-zinc-100 text-zinc-700 border-zinc-300'

  const fmtDate = (d: Date | string | null) =>
    d ? new Date(d).toLocaleDateString('pt-BR') : '—'

  return (
    <Card className={selected ? 'ring-2 ring-primary border-primary' : ''}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Checkbox
            checked={selected}
            onCheckedChange={onToggle}
            className="mt-1"
          />
          <div className="flex-1 min-w-0">
            {/* Header com score */}
            <div className="flex items-center justify-between gap-2 mb-3">
              <Badge variant="outline" className={`text-xs ${scoreColor}`}>
                Score {score}/100
              </Badge>
              {recommendation === 'AUTO_RECONCILE' && (
                <Badge variant="secondary" className="text-xs bg-emerald-50 text-emerald-700">
                  <Check className="h-3 w-3 mr-1" />
                  Auto-conciliação
                </Badge>
              )}
              {recommendation === 'CONFIRM' && (
                <Badge variant="secondary" className="text-xs bg-amber-50 text-amber-700">
                  ⚠ Confirme manualmente
                </Badge>
              )}
            </div>

            {/* 2 lados */}
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-3 mb-3">
              {/* OFX */}
              <div className="space-y-1 min-w-0">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Extrato bancário (OFX)
                </p>
                <p className="text-sm font-medium truncate">{ofx.description}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{fmtDate(ofx.date)}</span>
                  <span>·</span>
                  <span
                    className={`font-semibold tabular-nums ${ofx.type === 'CREDIT' ? 'text-emerald-600' : 'text-red-600'}`}
                  >
                    {ofx.type === 'CREDIT' ? '+' : '−'} {formatBRL(ofx.amount)}
                  </span>
                </div>
              </div>

              <ArrowRight className="h-4 w-4 text-muted-foreground hidden md:block" />

              {/* Candidato */}
              <div className="space-y-1 min-w-0">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {candidate.lifecycle === 'PAYABLE' ? 'Conta a pagar' : 'Conta a receber'}
                </p>
                <p className="text-sm font-medium truncate">{candidate.description}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>vence {fmtDate(candidate.dueDate)}</span>
                  <span>·</span>
                  <span
                    className={`font-semibold tabular-nums ${candidate.lifecycle === 'RECEIVABLE' ? 'text-emerald-600' : 'text-red-600'}`}
                  >
                    {candidate.lifecycle === 'RECEIVABLE' ? '+' : '−'} {formatBRL(candidate.amount)}
                  </span>
                </div>
              </div>
            </div>

            {/* Razões */}
            <div className="flex flex-wrap gap-1.5">
              {reasoning.map((r, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                >
                  <Check className="h-2.5 w-2.5" />
                  {r}
                </span>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
