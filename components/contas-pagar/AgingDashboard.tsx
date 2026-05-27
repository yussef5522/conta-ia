'use client'

// Sprint 5.0.3.0c (c4) — Aging Dashboard colapsável.
//
// Mostra distribuição de vencidas em 4 buckets (0-30/31-60/61-90/90+).
// Cada linha clicável → callback aplica filtro temporário.
// Default fechado; estado salvo em localStorage.

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, CheckCircle2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatBRL } from '@/lib/format/money'
import {
  AGING_BUCKET_IDS,
  AGING_COLORS,
  type AgingBucketId,
  type AgingResult,
} from '@/lib/contas-pagar/aging'

interface Props {
  result: AgingResult | null
  loading?: boolean
  onClickBucket: (id: AgingBucketId) => void
  storageKey?: string
}

const DEFAULT_STORAGE_KEY = 'caixaos:contas-pagar:aging-open'

export function AgingDashboard({
  result,
  loading,
  onClickBucket,
  storageKey = DEFAULT_STORAGE_KEY,
}: Props) {
  const [open, setOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  // Hidrata de localStorage no mount
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const stored = window.localStorage.getItem(storageKey)
      if (stored === 'true') setOpen(true)
    } catch {
      /* ignore */
    }
    setHydrated(true)
  }, [storageKey])

  // Persiste estado
  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return
    try {
      window.localStorage.setItem(storageKey, String(open))
    } catch {
      /* ignore */
    }
  }, [open, hydrated, storageKey])

  const hasVencidas = (result?.total.count ?? 0) > 0

  return (
    <Card data-testid="aging-dashboard">
      <CardContent className="py-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center gap-2 text-sm font-medium text-left hover:bg-muted/30 -mx-2 px-2 py-1 rounded"
          aria-expanded={open}
          aria-controls="aging-content"
          data-testid="aging-toggle"
        >
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <span>Análise de inadimplência</span>
          {hasVencidas && (
            <span className="text-xs text-muted-foreground ml-1">
              ({result!.total.count}{' '}
              {result!.total.count === 1 ? 'conta' : 'contas'} ·{' '}
              R$ {formatBRL(result!.total.amount)})
            </span>
          )}
        </button>

        {open && (
          <div id="aging-content" className="mt-3">
            {loading ? (
              <p className="text-xs text-muted-foreground py-3">
                Calculando aging...
              </p>
            ) : !hasVencidas ? (
              <div
                className="flex items-center gap-2 py-3 text-sm text-emerald-700 dark:text-emerald-300"
                data-testid="aging-empty"
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Nenhuma conta vencida. Seu fluxo está em dia!
              </div>
            ) : (
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="text-left px-2 py-1.5 font-medium">
                        Vencidas há
                      </th>
                      <th className="text-right px-2 py-1.5 font-medium">
                        Quantidade
                      </th>
                      <th className="text-right px-2 py-1.5 font-medium">
                        Valor
                      </th>
                      <th className="text-right px-2 py-1.5 font-medium">
                        % do total
                      </th>
                      <th className="px-2 py-1.5" aria-hidden="true" />
                    </tr>
                  </thead>
                  <tbody>
                    {AGING_BUCKET_IDS.map((id) => {
                      const bucket = result!.buckets.find((b) => b.id === id)!
                      const cores = AGING_COLORS[id]
                      const isEmpty = bucket.count === 0
                      return (
                        <tr
                          key={id}
                          className={`border-t hover:bg-muted/30 cursor-pointer ${
                            isEmpty ? 'opacity-40' : ''
                          }`}
                          onClick={() => !isEmpty && onClickBucket(id)}
                          data-testid={`aging-bucket-${id}`}
                        >
                          <td className="px-2 py-1.5">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-xs ${cores.bg} ${cores.text}`}
                            >
                              {cores.label}
                            </span>
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums">
                            {bucket.count}
                          </td>
                          <td
                            className={`px-2 py-1.5 text-right tabular-nums ${cores.text}`}
                          >
                            R$ {formatBRL(bucket.amount)}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground text-xs">
                            {bucket.percent.toFixed(1)}%
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            {!isEmpty && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onClickBucket(id)
                                }}
                              >
                                Filtrar →
                              </Button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                    <tr className="border-t font-medium">
                      <td className="px-2 py-1.5">Total</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {result!.total.count}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        R$ {formatBRL(result!.total.amount)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground text-xs">
                        100%
                      </td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
