'use client'

// Sprint 5.0.4.0b Fase 4 — UI Top Fornecedores.

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Building2, Trophy } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'

interface Row {
  supplierId: string
  nome: string
  cnpj: string | null
  rank: number
  amount: number
  count: number
  percentDoTotal: number
  trendPct: number | null
  trend: string
  trendVisual: { symbol: string; colorClass: string; label: string }
}

interface ApiResponse {
  rows: Row[]
  totalAmount: number
  totalCount: number
  totalSuppliersUnique: number
  concentracaoTop5: number
  period: { from: string; to: string }
}

interface Props {
  empresaId: string
}

function defaultPeriod(): { from: string; to: string } {
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth() + 1
  const first = `${y}-${String(m).padStart(2, '0')}-01`
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
  return { from: first, to: last }
}

function formatBRL(v: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  }).format(v)
}

export function FornecedoresClient({ empresaId }: Props) {
  const { toast } = useToast()
  const initial = defaultPeriod()
  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)
  const [topN, setTopN] = useState(10)
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!from || !to) return
    setLoading(true)
    const params = new URLSearchParams({ from, to, topN: String(topN) })
    fetch(`/api/empresas/${empresaId}/relatorios/fornecedores?${params}`, {
      credentials: 'include',
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => {
        toast({ variant: 'destructive', title: 'Falha ao carregar' })
      })
      .finally(() => setLoading(false))
  }, [empresaId, from, to, topN, toast])

  const concentracaoBar = useMemo(() => {
    if (!data) return null
    const filled = Math.min(100, data.concentracaoTop5)
    return { filled, empty: 100 - filled }
  }, [data])

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="py-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">De:</label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-auto h-9 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Até:</label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-auto h-9 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Top:</label>
            <Select value={String(topN)} onValueChange={(v) => setTopN(Number(v))}>
              <SelectTrigger className="w-auto min-w-[80px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
            <p className="text-sm">Calculando top fornecedores…</p>
          </CardContent>
        </Card>
      ) : !data || data.rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Building2 className="h-8 w-8 mx-auto mb-2 text-primary/40" />
            <p className="text-sm font-medium">Sem fornecedores no período</p>
            <p className="text-xs mt-1">
              Importe contas a pagar ou pague despesas vinculadas a fornecedores
              pra ver dados aqui.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats */}
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
            <Card>
              <CardContent className="py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Total pago
                </p>
                <p className="text-2xl font-semibold tabular-nums mt-0.5">
                  {formatBRL(data.totalAmount)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {data.totalCount} pagamento{data.totalCount !== 1 ? 's' : ''}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Fornecedores únicos
                </p>
                <p className="text-2xl font-semibold tabular-nums mt-0.5">
                  {data.totalSuppliersUnique}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Exibindo top {Math.min(topN, data.totalSuppliersUnique)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 flex items-start gap-2">
                <Trophy className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-1 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Top 1
                  </p>
                  <p className="text-base font-semibold mt-0.5 truncate">
                    {data.rows[0].nome}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                    {data.rows[0].percentDoTotal.toFixed(1)}% do total
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabela */}
          <Card>
            <CardContent className="py-3">
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="fornecedores-table">
                  <thead>
                    <tr className="border-b text-xs uppercase tracking-wide font-medium text-muted-foreground">
                      <th className="text-left px-3 py-2 w-12">#</th>
                      <th className="text-left px-3 py-2">Fornecedor</th>
                      <th className="text-right px-3 py-2">Valor</th>
                      <th className="text-right px-3 py-2">% Total</th>
                      <th className="text-center px-3 py-2">vs Mês ant</th>
                      <th className="text-right px-3 py-2">Pgtos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((r) => (
                      <tr
                        key={r.supplierId}
                        className="border-b last:border-0 hover:bg-muted/20"
                        data-testid={`fornecedor-row-${r.supplierId}`}
                      >
                        <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                          {r.rank}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="font-medium">{r.nome}</span>
                          {r.cnpj && (
                            <span className="ml-2 text-xs text-muted-foreground tabular-nums">
                              {r.cnpj}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-medium">
                          {formatBRL(r.amount)}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                          {r.percentDoTotal.toFixed(1)}%
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span
                            className={`inline-flex items-center gap-1 text-xs ${r.trendVisual.colorClass}`}
                            title={r.trendVisual.label}
                          >
                            <span className="text-base leading-none">
                              {r.trendVisual.symbol}
                            </span>
                            {r.trendPct !== null && (
                              <span className="tabular-nums">
                                {r.trendPct >= 0 ? '+' : ''}
                                {Math.round(r.trendPct)}%
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                          {r.count}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Concentração */}
          {concentracaoBar && data.totalSuppliersUnique >= 5 && (
            <Card>
              <CardContent className="py-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2 font-medium">
                  Concentração nos Top 5
                </p>
                <p className="text-sm mb-2">
                  Os 5 maiores fornecedores representam{' '}
                  <span className="font-semibold tabular-nums">
                    {data.concentracaoTop5.toFixed(1)}%
                  </span>{' '}
                  do total pago.
                </p>
                <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all"
                    style={{ width: `${concentracaoBar.filled}%` }}
                  />
                </div>
                {data.concentracaoTop5 > 60 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                    ⚠️ Alta concentração — risco de dependência. Considere
                    diversificar.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
