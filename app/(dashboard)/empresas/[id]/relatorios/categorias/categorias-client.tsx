'use client'

// Sprint 5.0.4.0a (a3) — UI Análise por Categoria.
// Bar chart horizontal (Recharts) + lista detalhada.

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Sparkles, Trophy } from 'lucide-react'
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
import { formatBRL } from '@/lib/format/money'
import { ExportReportButton } from '@/components/relatorios/ExportReportButton'
import {
  colorForIndex,
  type TopCategoriaRow,
  type TopCategoriasResult,
} from '@/lib/relatorios/categorias'

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

export function CategoriasClient({ empresaId }: Props) {
  const { toast } = useToast()
  const initial = defaultPeriod()
  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)
  const [tipo, setTipo] = useState<'DESPESA' | 'RECEITA' | 'TODOS'>('DESPESA')
  const [topN, setTopN] = useState(10)

  const [data, setData] = useState<TopCategoriasResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!from || !to) return
    setLoading(true)
    const params = new URLSearchParams({
      from,
      to,
      tipo,
      topN: String(topN),
    })
    fetch(`/api/empresas/${empresaId}/relatorios/categorias?${params}`, {
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
  }, [empresaId, from, to, tipo, topN, toast])

  const maxValue = useMemo(() => {
    if (!data || data.rows.length === 0) return 0
    return data.rows[0].amount
  }, [data])

  return (
    <div className="space-y-4">
      {/* Filtros */}
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
            <label className="text-sm text-muted-foreground">Tipo:</label>
            <Select
              value={tipo}
              onValueChange={(v) => setTipo(v as 'DESPESA' | 'RECEITA' | 'TODOS')}
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
            <label className="text-sm text-muted-foreground">Top:</label>
            <Select
              value={String(topN)}
              onValueChange={(v) => setTopN(Number(v))}
            >
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
          <div className="ml-auto">
            <ExportReportButton
              relatorio="categorias"
              empresaId={empresaId}
              filtrosQS={new URLSearchParams({
                from,
                to,
                tipo,
                topN: String(topN),
              }).toString()}
              disabled={loading || !data}
            />
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      {!loading && data && data.totalCategorias > 0 && (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
          <Card>
            <CardContent className="py-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Total {tipo === 'RECEITA' ? 'Receitas' : tipo === 'DESPESA' ? 'Despesas' : 'Movimentações'}
              </p>
              <p className="text-2xl font-semibold tabular-nums mt-0.5">
                R$ {formatBRL(data.totalAmount)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {data.totalCount} lançamento{data.totalCount !== 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Categorias usadas
              </p>
              <p className="text-2xl font-semibold tabular-nums mt-0.5">
                {data.totalCategorias}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Exibindo top {Math.min(topN, data.totalCategorias)}
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
                {data.rows[0] && (
                  <>
                    <p className="text-base font-semibold mt-0.5 truncate">
                      {data.rows[0].categoryName}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                      {data.rows[0].percent.toFixed(1)}% do total
                    </p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Gráfico de barras horizontal */}
      {loading ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
            <p className="text-sm">Calculando análise…</p>
          </CardContent>
        </Card>
      ) : !data || data.rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Sparkles className="h-8 w-8 mx-auto mb-2 text-primary/40" />
            <p className="text-sm font-medium">Sem dados no período</p>
            <p className="text-xs mt-1">
              Tente trocar o período ou o tipo acima.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-4 space-y-2">
            {data.rows.map((row, i) => (
              <CategoriaBar
                key={row.categoryId ?? `__none-${i}`}
                row={row}
                maxValue={maxValue}
                color={colorForIndex(i)}
              />
            ))}
            {data.outras && (
              <CategoriaBar
                row={data.outras}
                maxValue={maxValue}
                color="#94a3b8" // slate-400
                isOutras
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

interface BarProps {
  row: TopCategoriaRow
  maxValue: number
  color: string
  isOutras?: boolean
}

function CategoriaBar({ row, maxValue, color, isOutras }: BarProps) {
  const widthPct = maxValue > 0 ? (row.amount / maxValue) * 100 : 0
  return (
    <div
      className="flex items-center gap-3 py-1.5 hover:bg-muted/30 -mx-2 px-2 rounded"
      data-testid={`categoria-bar-${row.categoryId ?? 'none'}`}
    >
      <div className="w-36 sm:w-48 shrink-0 truncate text-sm">
        <span className={isOutras ? 'italic text-muted-foreground' : ''}>
          {row.categoryName}
        </span>
      </div>
      <div className="flex-1 min-w-0 h-6 bg-muted/40 rounded-sm relative overflow-hidden">
        <div
          className="h-full transition-all duration-300"
          style={{ width: `${widthPct}%`, backgroundColor: color }}
        />
      </div>
      <div className="w-32 shrink-0 text-right text-sm">
        <span className="tabular-nums font-medium">
          R$ {formatBRL(row.amount)}
        </span>
        <span className="ml-2 text-xs text-muted-foreground tabular-nums">
          ({row.percent.toFixed(1)}%)
        </span>
      </div>
    </div>
  )
}
