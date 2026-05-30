'use client'

// Sprint 5.0.4.0b Fase 3 — UI Client do Fluxo de Caixa.
// Filtros (meses 3/6/12) + fetch endpoint + stats + chart + projeção.

import { useEffect, useMemo, useState } from 'react'
import { Loader2, TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { CashFlowChartDynamic } from '@/components/relatorios/fluxo-caixa/CashFlowChartWrapper'
import { ExportReportButton } from '@/components/relatorios/ExportReportButton'

interface MonthRow {
  monthKey: string
  income: number
  expense: number
  net: number
}

interface AcumRow {
  monthKey: string
  saldo: number
}

interface ProjectionBucket {
  id: '30d' | '60d' | '90d'
  label: string
  entradas: number
  saidas: number
  resultado: number
}

interface FluxoResponse {
  modo: 'realizado' | 'previsto' | 'ambos'
  saldoAtual: number
  meses: number
  realizado: {
    byMonth: MonthRow[]
    totals: { income: number; expense: number; net: number; transactionCount: number }
    acumulado: AcumRow[]
  }
  projecao: {
    buckets: ProjectionBucket[]
    total: { entradas: number; saidas: number; resultado: number }
  }
}

interface Props {
  empresaId: string
}

function formatBRL(v: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  }).format(v)
}

function formatBRLCompact(v: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(v)
}

export function FluxoCaixaClient({ empresaId }: Props) {
  const { toast } = useToast()
  const [meses, setMeses] = useState(6)
  const [modo, setModo] = useState<'realizado' | 'previsto' | 'ambos'>('ambos')
  const [data, setData] = useState<FluxoResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ meses: String(meses), modo })
    fetch(`/api/empresas/${empresaId}/relatorios/fluxo-caixa?${params}`, {
      credentials: 'include',
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => {
        toast({
          variant: 'destructive',
          title: 'Falha ao carregar',
        })
      })
      .finally(() => setLoading(false))
  }, [empresaId, meses, modo, toast])

  const chartData = useMemo(() => {
    if (!data) return []
    const acumByMonth = new Map(
      data.realizado.acumulado.map((a) => [a.monthKey, a.saldo]),
    )
    return data.realizado.byMonth.map((m) => ({
      monthKey: m.monthKey,
      income: m.income,
      expense: m.expense,
      saldoAcumulado: acumByMonth.get(m.monthKey) ?? 0,
    }))
  }, [data])

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card>
        <CardContent className="py-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Período:</label>
            <Select
              value={String(meses)}
              onValueChange={(v) => setMeses(Number(v))}
            >
              <SelectTrigger className="w-auto min-w-[140px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">Últimos 3 meses</SelectItem>
                <SelectItem value="6">Últimos 6 meses</SelectItem>
                <SelectItem value="12">Últimos 12 meses</SelectItem>
                <SelectItem value="24">Últimos 24 meses</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Visualização:</label>
            <Select
              value={modo}
              onValueChange={(v) => setModo(v as 'realizado' | 'previsto' | 'ambos')}
            >
              <SelectTrigger className="w-auto min-w-[120px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ambos">Realizado + Previsto</SelectItem>
                <SelectItem value="realizado">Só Realizado</SelectItem>
                <SelectItem value="previsto">Só Previsto</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* Sprint Export CSV+PDF (29/05/2026) — Botão Exportar */}
          <div className="ml-auto">
            <ExportReportButton
              relatorio="fluxo-caixa"
              empresaId={empresaId}
              filtrosQS={new URLSearchParams({ meses: String(meses) }).toString()}
              disabled={loading || !data}
            />
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
            <p className="text-sm">Calculando fluxo de caixa…</p>
          </CardContent>
        </Card>
      ) : !data ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="text-sm">Sem dados.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats 4 cards */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Entradas"
              value={formatBRLCompact(data.realizado.totals.income)}
              icon={TrendingUp}
              tone="emerald"
            />
            <StatCard
              label="Saídas"
              value={formatBRLCompact(data.realizado.totals.expense)}
              icon={TrendingDown}
              tone="red"
            />
            <StatCard
              label="Resultado"
              value={
                (data.realizado.totals.net >= 0 ? '+' : '') +
                formatBRLCompact(data.realizado.totals.net)
              }
              icon={Wallet}
              tone={data.realizado.totals.net >= 0 ? 'emerald' : 'red'}
              big
            />
            <StatCard
              label="Saldo atual"
              value={formatBRLCompact(data.saldoAtual)}
              icon={Wallet}
              tone={data.saldoAtual >= 0 ? 'sky' : 'red'}
            />
          </div>

          {/* Chart */}
          {(modo === 'ambos' || modo === 'realizado') && (
            <Card>
              <CardContent className="py-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold">Entradas vs Saídas</h3>
                  <p className="text-xs text-muted-foreground">
                    Últimos {data.meses} meses
                  </p>
                </div>
                <CashFlowChartDynamic data={chartData} />
              </CardContent>
            </Card>
          )}

          {/* Projeção */}
          {(modo === 'ambos' || modo === 'previsto') && (
            <Card>
              <CardContent className="py-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold">
                    Projeção 30 · 60 · 90 dias
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Baseado em contas a pagar/receber não pagas com vencimento futuro
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="text-left px-3 py-2 font-medium">Período</th>
                        <th className="text-right px-3 py-2 font-medium">
                          Entradas previstas
                        </th>
                        <th className="text-right px-3 py-2 font-medium">
                          Saídas previstas
                        </th>
                        <th className="text-right px-3 py-2 font-medium">
                          Resultado
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.projecao.buckets.map((b) => (
                        <tr
                          key={b.id}
                          className="border-b last:border-0"
                          data-testid={`proj-${b.id}`}
                        >
                          <td className="px-3 py-2.5 font-medium">{b.label}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                            {formatBRL(b.entradas)}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-red-600 dark:text-red-400">
                            {formatBRL(b.saidas)}
                          </td>
                          <td
                            className={`px-3 py-2.5 text-right tabular-nums font-semibold ${
                              b.resultado >= 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-red-600 dark:text-red-400'
                            }`}
                          >
                            {b.resultado >= 0 ? '+' : ''}
                            {formatBRL(b.resultado)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {data.projecao.total.entradas === 0 &&
                  data.projecao.total.saidas === 0 && (
                    <p className="text-xs text-muted-foreground italic mt-3">
                      Sem contas a pagar ou receber vencendo nos próximos 90 dias.
                      Lance algumas em <strong>Contas a Pagar</strong> ou{' '}
                      <strong>Contas a Receber</strong> pra ativar a projeção.
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

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
  big,
}: {
  label: string
  value: string
  icon: typeof TrendingUp
  tone: 'emerald' | 'red' | 'sky'
  big?: boolean
}) {
  const toneClass =
    tone === 'emerald'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'red'
        ? 'text-red-600 dark:text-red-400'
        : 'text-sky-600 dark:text-sky-400'
  return (
    <Card>
      <CardContent className="py-3 flex items-start gap-3">
        <div className={`mt-0.5 shrink-0 ${toneClass}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p
            className={`tabular-nums font-semibold ${big ? 'text-xl' : 'text-base'} ${toneClass} mt-0.5 truncate`}
          >
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
