// Sprint PF Fatia 3 — Insights: assinaturas recorrentes.

'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, Sparkles, TrendingUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface RecurringItem {
  merchantKey: string
  displayName: string
  monthsActive: number
  avgAmount: number
  amountStdevPercent: number
  lastSeenAt: string
  predictedNextDate: string
  txCount: number
}

function formatBRL(n: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
}

export default function InsightsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [recurring, setRecurring] = useState<RecurringItem[]>([])
  const [monthlyTotal, setMonthlyTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/perfis/${id}/insights/recorrentes`)
      .then((r) => r.json())
      .then((d) => {
        setRecurring(d.recurring ?? [])
        setMonthlyTotal(d.monthlyTotal ?? 0)
      })
      .finally(() => setLoading(false))
  }, [id])

  return (
    <div>
      <Link
        href={`/perfis/${id}`}
        className="inline-flex items-center gap-1 text-sm text-zinc-600 hover:text-zinc-900 mb-3"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Voltar
      </Link>

      <div className="flex items-start gap-3 mb-6">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-700">
          <Sparkles className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Insights</h1>
          <p className="text-sm text-zinc-600">
            Padrões detectados automaticamente
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      ) : recurring.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center">
            <Sparkles className="h-10 w-10 mx-auto text-zinc-300 mb-3" />
            <p className="text-sm text-zinc-600 max-w-md mx-auto">
              Nenhuma assinatura recorrente detectada ainda. Importe pelo menos
              3 faturas de cartão pra começar a ver padrões.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Card de impacto mensal */}
          <Card className="mb-4 bg-gradient-to-br from-purple-600 to-purple-700 text-white border-0">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-purple-100 text-xs font-medium mb-1">
                <TrendingUp className="h-3 w-3" />
                Total mensal em assinaturas
              </div>
              <div className="text-3xl font-bold tabular-nums">
                {formatBRL(monthlyTotal)}
              </div>
              <div className="text-xs text-purple-200 mt-1">
                {recurring.length} assinaturas recorrentes
              </div>
            </CardContent>
          </Card>

          <h2 className="font-semibold text-zinc-900 mb-3">Assinaturas detectadas</h2>
          <div className="space-y-2">
            {recurring.map((r) => (
              <Card key={r.merchantKey}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-zinc-900 truncate">{r.displayName}</div>
                    <div className="text-xs text-zinc-500">
                      {r.monthsActive} meses ativo · {r.txCount} cobranças · próxima ≈{' '}
                      {new Date(r.predictedNextDate).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold tabular-nums text-zinc-900">
                      {formatBRL(r.avgAmount)}
                    </div>
                    <div className="text-[10px] text-zinc-500">/mês</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
