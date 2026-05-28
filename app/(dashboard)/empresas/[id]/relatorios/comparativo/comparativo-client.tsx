'use client'

// Sprint 5.0.4.0a (a2) — UI client do Comparativo 3 Meses.

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'
import {
  TREND_VISUAL,
  filterRows,
  type ComparativoRow,
  type ComparativoTipoFilter,
  type ComparativoFilterMode,
  type MonthRange,
} from '@/lib/relatorios/comparativo'

interface ApiResponse {
  rows: ComparativoRow[]
  totals: { prev2: number; prev1: number; current: number; total: number }
  meses: { prev2: MonthRange; prev1: MonthRange; current: MonthRange }
}

interface Props {
  empresaId: string
}

function currentYearMonth(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function generateRefMonthOptions(currentRef: string): string[] {
  // 12 meses a partir do mês atual pra trás
  const [y, m] = currentRef.split('-').map(Number)
  const result: string[] = []
  let year = y
  let month = m
  for (let i = 0; i < 12; i++) {
    result.push(`${year}-${String(month).padStart(2, '0')}`)
    month--
    if (month < 1) {
      month = 12
      year--
    }
  }
  return result
}

function labelForRef(ym: string): string {
  const MES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  const [y, m] = ym.split('-').map(Number)
  return `${MES[m - 1]}/${String(y).slice(-2)}`
}

export function ComparativoClient({ empresaId }: Props) {
  const { toast } = useToast()
  const [refMonth, setRefMonth] = useState(currentYearMonth())
  const [tipo, setTipo] = useState<ComparativoTipoFilter>('DESPESA')
  const [filterMode, setFilterMode] =
    useState<ComparativoFilterMode['filter']>('ALL')

  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ refMonth, tipo })
    fetch(`/api/empresas/${empresaId}/relatorios/comparativo?${params}`, {
      credentials: 'include',
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => {
        toast({
          variant: 'destructive',
          title: 'Falha ao carregar',
          description: 'Tente novamente.',
        })
      })
      .finally(() => setLoading(false))
  }, [empresaId, refMonth, tipo, toast])

  const filteredRows = useMemo(
    () => (data ? filterRows(data.rows, filterMode) : []),
    [data, filterMode],
  )

  const refOptions = useMemo(
    () => generateRefMonthOptions(currentYearMonth()),
    [],
  )

  const counts = useMemo(() => {
    if (!data) return { novas: 0, subindo: 0, descendo: 0 }
    const novas = data.rows.filter((r) => r.trend.indicator === 'NEW').length
    const subindo = data.rows.filter(
      (r) => r.trend.indicator === 'UP' || r.trend.indicator === 'UP_STRONG',
    ).length
    const descendo = data.rows.filter(
      (r) => r.trend.indicator === 'DOWN' || r.trend.indicator === 'DOWN_STRONG',
    ).length
    return { novas, subindo, descendo }
  }, [data])

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card>
        <CardContent className="py-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Referência:</label>
            <Select value={refMonth} onValueChange={setRefMonth}>
              <SelectTrigger className="w-auto min-w-[120px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {refOptions.map((ym) => (
                  <SelectItem key={ym} value={ym}>
                    {labelForRef(ym)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Tipo:</label>
            <Select
              value={tipo}
              onValueChange={(v) => setTipo(v as ComparativoTipoFilter)}
            >
              <SelectTrigger className="w-auto min-w-[120px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DESPESA">Despesas</SelectItem>
                <SelectItem value="RECEITA">Receitas</SelectItem>
                <SelectItem value="TODOS">Todos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Mostrar:</label>
            <Select
              value={filterMode}
              onValueChange={(v) =>
                setFilterMode(v as ComparativoFilterMode['filter'])
              }
            >
              <SelectTrigger className="w-auto min-w-[140px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tudo</SelectItem>
                <SelectItem value="UP_ONLY">Só subindo ↑</SelectItem>
                <SelectItem value="DOWN_ONLY">Só descendo ↓</SelectItem>
                <SelectItem value="NEW_ONLY">Só novas 🆕</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Stats counts */}
      {!loading && data && (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
          <Card>
            <CardContent className="py-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Categorias novas neste mês
              </p>
              <p className="text-2xl font-semibold text-purple-600 dark:text-purple-400 mt-0.5">
                {counts.novas}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                🆕 apareceram pela 1ª vez
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Subindo
              </p>
              <p className="text-2xl font-semibold text-amber-600 dark:text-amber-400 mt-0.5">
                {counts.subindo}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                ↑ vs mês anterior
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Descendo
              </p>
              <p className="text-2xl font-semibold text-sky-600 dark:text-sky-400 mt-0.5">
                {counts.descendo}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                ↓ vs mês anterior
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabela */}
      {loading ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
            <p className="text-sm">Calculando comparativo…</p>
          </CardContent>
        </Card>
      ) : !data || data.rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Sparkles className="h-8 w-8 mx-auto mb-2 text-primary/40" />
            <p className="text-sm font-medium">Sem dados nos últimos 3 meses</p>
            <p className="text-xs mt-1">
              Tente trocar o mês de referência ou o tipo de filtro acima.
            </p>
          </CardContent>
        </Card>
      ) : filteredRows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="text-sm">
              Nenhuma categoria bate com o filtro &quot;
              {filterMode === 'UP_ONLY'
                ? 'Só subindo'
                : filterMode === 'DOWN_ONLY'
                  ? 'Só descendo'
                  : 'Só novas'}
              &quot;.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={() => setFilterMode('ALL')}
            >
              Mostrar tudo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="comparativo-table">
              <thead>
                <tr className="border-b bg-muted/30 text-xs uppercase tracking-wide font-medium text-muted-foreground">
                  <th className="text-left px-3 py-2">Categoria</th>
                  <th className="text-right px-3 py-2 tabular-nums">
                    {data.meses.prev2.label}
                  </th>
                  <th className="text-right px-3 py-2 tabular-nums">
                    {data.meses.prev1.label}
                  </th>
                  <th className="text-right px-3 py-2 tabular-nums">
                    {data.meses.current.label}
                  </th>
                  <th className="text-center px-3 py-2">Tendência</th>
                  <th className="text-right px-3 py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const visual = TREND_VISUAL[row.trend.indicator]
                  const pct = row.trend.percentVsPrev1
                  return (
                    <tr
                      key={row.categoryId ?? '__sem__'}
                      className="border-b last:border-0 hover:bg-muted/20 transition-colors"
                      data-testid={`comparativo-row-${row.categoryId ?? 'none'}`}
                    >
                      <td className="px-3 py-2.5">
                        <span className="font-medium">{row.categoryName}</span>
                        {row.dreGroup && (
                          <span className="ml-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                            {row.dreGroup.replace(/_/g, ' ').toLowerCase()}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                        {row.prev2 > 0 ? formatBRL(row.prev2) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                        {row.prev1 > 0 ? formatBRL(row.prev1) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-medium">
                        {row.current > 0 ? formatBRL(row.current) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span
                          className={`inline-flex items-center gap-1 text-xs ${visual.colorClass}`}
                          title={visual.label}
                        >
                          <span className="text-base leading-none">
                            {visual.symbol}
                          </span>
                          {pct !== null && (
                            <span className="tabular-nums">
                              {pct >= 0 ? '+' : ''}
                              {Math.round(pct * 100)}%
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-medium">
                        {formatBRL(row.total)}
                      </td>
                    </tr>
                  )
                })}
                {/* Total row */}
                <tr className="border-t-2 font-semibold bg-muted/20">
                  <td className="px-3 py-2.5">Total</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {formatBRL(data.totals.prev2)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {formatBRL(data.totals.prev1)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {formatBRL(data.totals.current)}
                  </td>
                  <td className="px-3 py-2.5" />
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {formatBRL(data.totals.total)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
