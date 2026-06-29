// Sprint Transferências Redesign (28/06/2026) — Fluxo entre contas.
// Barras horizontais por conta (enviado + recebido) com insight textual.

'use client'

import { Card, CardContent } from '@/components/ui/card'
import { AccountKindBadge } from '@/components/shared/AccountKindBadge'
import { formatBRL } from '@/lib/format/money'
import { Lightbulb } from 'lucide-react'

interface Conta {
  id: string
  name: string
  bankName: string | null
  accountKind: 'PJ' | 'PF'
  enviado: number
  recebido: number
  countOut: number
  countIn: number
}

interface Props {
  contas: Conta[]
  insight: string
}

export function FluxoContas({ contas, insight }: Props) {
  // Ordena por movimentação total desc
  const ordered = [...contas]
    .map((c) => ({ ...c, total: c.enviado + c.recebido }))
    .sort((a, b) => b.total - a.total)
  const max = Math.max(...ordered.map((c) => c.total), 1)

  if (ordered.every((c) => c.total === 0)) {
    return (
      <Card className="rounded-xl border-slate-200/70 dark:border-slate-800/70">
        <CardContent className="py-10 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhuma transferência entre contas este mês.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="rounded-xl border-slate-200/70 dark:border-slate-800/70">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">
              Fluxo entre contas
            </h3>
            <p className="text-xs text-muted-foreground">No mês corrente</p>
          </div>
        </div>

        {/* Barras */}
        <div className="space-y-3">
          {ordered.map((c) => {
            const enviadoPct = (c.enviado / max) * 100
            const recebidoPct = (c.recebido / max) * 100
            return (
              <div key={c.id}>
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium truncate">{c.name}</span>
                    <AccountKindBadge kind={c.accountKind} />
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {c.countOut + c.countIn} tx
                  </span>
                </div>
                <div className="space-y-1">
                  {c.enviado > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-red-400 dark:bg-red-500"
                          style={{ width: `${enviadoPct}%` }}
                        />
                      </div>
                      <span className="text-[11px] tabular-nums text-muted-foreground w-24 text-right">
                        − {formatBRL(c.enviado)}
                      </span>
                    </div>
                  )}
                  {c.recebido > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 dark:bg-emerald-500"
                          style={{ width: `${recebidoPct}%` }}
                        />
                      </div>
                      <span className="text-[11px] tabular-nums text-muted-foreground w-24 text-right">
                        + {formatBRL(c.recebido)}
                      </span>
                    </div>
                  )}
                  {c.enviado === 0 && c.recebido === 0 && (
                    <p className="text-[11px] text-muted-foreground italic">
                      sem movimento
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Insight */}
        <div className="flex items-start gap-2 pt-3 border-t border-slate-200/60 dark:border-slate-800/60">
          <Lightbulb className="h-3.5 w-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">{insight}</p>
        </div>
      </CardContent>
    </Card>
  )
}
