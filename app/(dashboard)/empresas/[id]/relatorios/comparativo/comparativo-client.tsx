'use client'

// Sprint Comparativo-A (28/05/2026) — UI multi-período com média + heatmap.

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Sparkles, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react'
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
  CELL_TONE_CLASSES,
  filterRowsMulti,
  getDesvioVisual,
  formatDesvioPct,
  type ComparativoRowMulti,
  type ComparativoTipoFilter,
  type ComparativoFilterMode,
  type Granularidade,
  type PeriodoBucket,
} from '@/lib/relatorios/comparativo'

interface ApiResponseMulti {
  multi: true
  rows: ComparativoRowMulti[]
  totals: {
    porPeriodo: number[]
    mediaHistorica: number | null
    desvioPct: number | null
    referenciaVazia: boolean
    total: number
  }
  periodos: PeriodoBucket[]
  summary: {
    novas: number
    subindo: number
    descendo: number
    foraDaMedia: number
  }
}

interface Props {
  empresaId: string
}

const MES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function currentYearMonth(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function generateRefMonthOptions(currentRef: string): string[] {
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
  const [y, m] = ym.split('-').map(Number)
  return `${MES[m - 1]}/${String(y).slice(-2)}`
}


export function ComparativoClient({ empresaId }: Props) {
  const { toast } = useToast()
  const [refMonth, setRefMonth] = useState(currentYearMonth())
  const [tipo, setTipo] = useState<ComparativoTipoFilter>('DESPESA')
  const [meses, setMeses] = useState<number>(3)
  const [granularidade, setGranularidade] = useState<Granularidade>('mes')
  const [filterMode, setFilterMode] =
    useState<ComparativoFilterMode['filter']>('ALL')

  const [data, setData] = useState<ApiResponseMulti | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({
      refMonth,
      tipo,
      meses: String(meses),
      granularidade,
    })
    fetch(`/api/empresas/${empresaId}/relatorios/comparativo?${params}`, {
      credentials: 'include',
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        // Hotfix 28/05/2026: servidor sempre retorna shape multi (caminho
        // legacy isLegacyShape removido pra resolver bug da média vazia).
        setData(d as ApiResponseMulti)
      })
      .catch(() => {
        toast({
          variant: 'destructive',
          title: 'Falha ao carregar',
          description: 'Tente novamente.',
        })
      })
      .finally(() => setLoading(false))
  }, [empresaId, refMonth, tipo, meses, granularidade, toast])

  const filteredRows = useMemo(
    () => (data ? filterRowsMulti(data.rows, filterMode) : []),
    [data, filterMode],
  )

  const refOptions = useMemo(
    () => generateRefMonthOptions(currentYearMonth()),
    [],
  )

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card>
        <CardContent className="py-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Referência:</label>
            <Select value={refMonth} onValueChange={setRefMonth}>
              <SelectTrigger className="w-auto min-w-[110px] h-9 text-sm">
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
            <label className="text-sm text-muted-foreground">Períodos:</label>
            <Select
              value={String(meses)}
              onValueChange={(v) => setMeses(Number(v))}
            >
              <SelectTrigger className="w-auto min-w-[90px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="3">3</SelectItem>
                <SelectItem value="6">6</SelectItem>
                <SelectItem value="12">12</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Granularidade:</label>
            <Select
              value={granularidade}
              onValueChange={(v) => setGranularidade(v as Granularidade)}
            >
              <SelectTrigger className="w-auto min-w-[120px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mes">Mês</SelectItem>
                <SelectItem value="trimestre">Trimestre</SelectItem>
                <SelectItem value="ano">Ano</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Tipo:</label>
            <Select
              value={tipo}
              onValueChange={(v) => setTipo(v as ComparativoTipoFilter)}
            >
              <SelectTrigger className="w-auto min-w-[110px] h-9 text-sm">
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
              <SelectTrigger className="w-auto min-w-[130px] h-9 text-sm">
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

      {/* Stats cards */}
      {!loading && data && (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={Sparkles}
            label="Categorias novas"
            value={data.summary.novas}
            tone="purple"
            subtext="🆕 apareceram este período"
          />
          <StatCard
            icon={TrendingUp}
            label="Subindo"
            value={data.summary.subindo}
            tone="amber"
            subtext="↑ vs período anterior"
          />
          <StatCard
            icon={TrendingDown}
            label="Descendo"
            value={data.summary.descendo}
            tone="sky"
            subtext="↓ vs período anterior"
          />
          <StatCard
            icon={AlertTriangle}
            label="Fora da média"
            value={data.summary.foraDaMedia}
            tone="red"
            subtext="custos acima do normal"
          />
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
            <p className="text-sm font-medium">Sem dados nos {meses} {granularidade === 'ano' ? 'anos' : granularidade === 'trimestre' ? 'trimestres' : 'meses'} selecionados</p>
            <p className="text-xs mt-1">
              Tente trocar o mês de referência, número de períodos ou tipo.
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
        <div className="rounded-md border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse" data-testid="comparativo-table">
              <thead>
                <tr className="border-b bg-muted/30 text-xs uppercase tracking-wide font-medium text-muted-foreground">
                  <th className="text-left px-3 py-2 sticky left-0 bg-muted/30 z-10 min-w-[180px]">
                    Categoria
                  </th>
                  {data.periodos.map((p) => (
                    <th
                      key={p.id}
                      className="text-right px-3 py-2 tabular-nums min-w-[88px]"
                    >
                      {p.label}
                    </th>
                  ))}
                  <th className="text-right px-3 py-2 tabular-nums bg-muted/50 min-w-[100px]">
                    Média
                  </th>
                  <th className="text-center px-3 py-2 tabular-nums bg-muted/50 min-w-[110px]">
                    vs Média
                  </th>
                  <th className="text-right px-3 py-2 tabular-nums min-w-[100px]">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <Row key={row.categoryId ?? '__sem__'} row={row} tipo={tipo} />
                ))}
                {/* Linha Total */}
                <tr className="border-t-2 font-semibold bg-muted/20">
                  <td className="px-3 py-2.5 sticky left-0 bg-muted/20 z-10">
                    Total
                  </td>
                  {data.totals.porPeriodo.map((v, i) => (
                    <td key={i} className="px-3 py-2.5 text-right tabular-nums">
                      {formatBRL(v)}
                    </td>
                  ))}
                  <td className="px-3 py-2.5 text-right tabular-nums bg-muted/30">
                    {data.totals.mediaHistorica !== null
                      ? formatBRL(data.totals.mediaHistorica)
                      : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-center bg-muted/30">
                    {(() => {
                      // Linha Total usa o mesmo helper, tom 'DESPESA' por
                      // padrão (totals agregados sem distinção de tipo)
                      const totalDesvio = getDesvioVisual(
                        data.totals.desvioPct,
                        data.totals.referenciaVazia,
                        tipo === 'RECEITA' ? 'RECEITA' : 'DESPESA',
                      )
                      if (totalDesvio.status === 'ref-vazia') {
                        return (
                          <span className="text-xs text-muted-foreground italic">
                            ref. vazia
                          </span>
                        )
                      }
                      if (totalDesvio.status === 'sem-media') {
                        return <span className="text-xs">—</span>
                      }
                      return (
                        <span
                          className={`inline-flex items-center gap-1 text-xs ${totalDesvio.colorClass}`}
                          title={totalDesvio.label}
                        >
                          <span className="text-base leading-none">
                            {totalDesvio.symbol}
                          </span>
                          <span className="tabular-nums">
                            {formatDesvioPct(data.totals.desvioPct)}
                          </span>
                        </span>
                      )
                    })()}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {formatBRL(data.totals.total)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Legenda do heatmap */}
          <div className="px-3 py-2 border-t bg-muted/10 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="font-medium">Heatmap:</span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded bg-red-50 dark:bg-red-950/40 border border-red-200" />
              fora da média leve
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded bg-red-100 dark:bg-red-900/50 border border-red-300" />
              moderado
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded bg-red-200 dark:bg-red-800/60 border border-red-400" />
              forte
            </span>
            <span className="text-muted-foreground/60">·</span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded bg-emerald-100 dark:bg-emerald-900/50 border border-emerald-300" />
              abaixo da média = bom (despesa)
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// Componentes auxiliares
// ────────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
  subtext,
}: {
  icon: typeof Sparkles
  label: string
  value: number
  tone: 'purple' | 'amber' | 'sky' | 'red'
  subtext: string
}) {
  const toneClasses = {
    purple: 'text-purple-600 dark:text-purple-400',
    amber: 'text-amber-600 dark:text-amber-400',
    sky: 'text-sky-600 dark:text-sky-400',
    red: 'text-red-600 dark:text-red-400',
  }
  return (
    <Card>
      <CardContent className="py-3">
        <div className={`flex items-center gap-2 ${toneClasses[tone]}`}>
          <Icon className="h-4 w-4 shrink-0" />
          <p className="text-[10px] uppercase tracking-wider font-medium">
            {label}
          </p>
        </div>
        <p
          className={`text-2xl font-semibold tabular-nums mt-1 ${toneClasses[tone]}`}
        >
          {value}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{subtext}</p>
      </CardContent>
    </Card>
  )
}

function Row({
  row,
  tipo,
}: {
  row: ComparativoRowMulti
  tipo: ComparativoTipoFilter
}) {
  const tipoSemantic: 'DESPESA' | 'RECEITA' =
    tipo === 'RECEITA' ? 'RECEITA' : 'DESPESA'
  // Hotfix 28/05/2026: coluna "vs Média" agora usa desvioPct (não trend.indicator)
  const desvio = getDesvioVisual(row.desvioPct, row.referenciaVazia, tipoSemantic)

  return (
    <tr
      className="border-b last:border-0 hover:bg-muted/20 transition-colors"
      data-testid={`comparativo-row-${row.categoryId ?? 'none'}`}
    >
      <td className="px-3 py-2.5 sticky left-0 bg-card group-hover:bg-muted/20 z-10">
        <div className="font-medium">{row.categoryName}</div>
        {row.dreGroup && (
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">
            {row.dreGroup.replace(/_/g, ' ').toLowerCase()}
          </div>
        )}
      </td>
      {row.values.map((v, i) => {
        const tone = row.cellTones[i] ?? 'transparent'
        const toneClass = CELL_TONE_CLASSES[tone]
        return (
          <td
            key={i}
            className={`px-3 py-2.5 text-right tabular-nums ${toneClass}`}
            data-tone={tone}
          >
            {v > 0 ? formatBRL(v) : '—'}
          </td>
        )
      })}
      <td className="px-3 py-2.5 text-right tabular-nums bg-muted/20 font-medium">
        {row.mediaHistorica !== null ? formatBRL(row.mediaHistorica) : '—'}
      </td>
      <td className="px-3 py-2.5 text-center bg-muted/20">
        {desvio.status === 'ref-vazia' ? (
          <span
            className={`inline-flex items-center gap-1 text-xs ${desvio.colorClass}`}
            title={desvio.label}
            data-testid={`desvio-${row.categoryId ?? 'none'}-${desvio.status}`}
          >
            ref. vazia
          </span>
        ) : desvio.status === 'sem-media' ? (
          <span
            className="text-xs text-muted-foreground"
            data-testid={`desvio-${row.categoryId ?? 'none'}-sem-media`}
          >
            —
          </span>
        ) : (
          <span
            className={`inline-flex items-center gap-1 text-xs ${desvio.colorClass}`}
            title={desvio.label}
            data-testid={`desvio-${row.categoryId ?? 'none'}-${desvio.status}`}
          >
            <span className="text-base leading-none">{desvio.symbol}</span>
            <span className="tabular-nums">
              {formatDesvioPct(row.desvioPct)}
            </span>
          </span>
        )}
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums font-medium">
        {formatBRL(row.total)}
      </td>
    </tr>
  )
}
