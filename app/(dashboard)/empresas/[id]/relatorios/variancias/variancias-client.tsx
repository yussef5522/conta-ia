'use client'

// Sprint 5.0.4.0c1 Fase 3 — UI Variâncias.

import { useEffect, useMemo, useState } from 'react'
import {
  Loader2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Search,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { ExportReportButton } from '@/components/relatorios/ExportReportButton'
import {
  classesForLevel,
  VARIANCE_LEVEL_VISUAL,
  dreGroupLabel,
} from '@/lib/variance/format'
import type {
  VarianceResult,
  VarianceSummary,
  VarianceSeverity,
  VarianceType,
} from '@/lib/variance/detect-variances'

interface ApiResponse {
  variances: VarianceResult[]
  summary: VarianceSummary
  periods: {
    current: { ym: string; start: string; end: string }
    base: { ym: string; start: string; end: string }
  }
  totals: { currentSum: number; baseSum: number }
  minAbsoluteValue: number
}

interface Props {
  empresaId: string
}

type SeverityFilter = 'all' | VarianceSeverity
type TypeFilter = 'all' | VarianceType

function formatBRL(v: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  }).format(v)
}

function formatBRLCompact(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace('.', ',')}M`
  if (abs >= 1_000) return `R$ ${(v / 1_000).toFixed(1).replace('.', ',')}k`
  return formatBRL(v)
}

function currentYearMonth(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function prevYearMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  const month = m === 1 ? 12 : m - 1
  const year = m === 1 ? y - 1 : y
  return `${year}-${String(month).padStart(2, '0')}`
}

const MES_FULL = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

function labelYM(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return `${MES_FULL[m - 1]}/${y}`
}

function generateRefOptions(currentRef: string, count = 12): string[] {
  const [y, m] = currentRef.split('-').map(Number)
  const result: string[] = []
  let year = y
  let month = m
  for (let i = 0; i < count; i++) {
    result.push(`${year}-${String(month).padStart(2, '0')}`)
    month--
    if (month < 1) {
      month = 12
      year--
    }
  }
  return result
}

export function VarianciasClient({ empresaId }: Props) {
  const { toast } = useToast()
  const today = currentYearMonth()
  const [current, setCurrent] = useState(today)
  const [base, setBase] = useState(prevYearMonth(today))
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const refOptions = useMemo(() => generateRefOptions(today, 12), [today])

  useEffect(() => {
    if (current === base) {
      toast({
        variant: 'destructive',
        title: 'Períodos iguais',
        description: 'Escolha 2 meses diferentes pra comparar.',
      })
      return
    }
    setLoading(true)
    const params = new URLSearchParams({ current, base })
    fetch(`/api/empresas/${empresaId}/relatorios/variancias?${params}`, {
      credentials: 'include',
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => {
        toast({ variant: 'destructive', title: 'Falha ao carregar' })
      })
      .finally(() => setLoading(false))
  }, [empresaId, current, base, toast])

  const filtered = useMemo(() => {
    if (!data) return []
    return data.variances.filter((v) => {
      if (severityFilter !== 'all' && v.severity !== severityFilter) return false
      if (typeFilter !== 'all' && v.type !== typeFilter) return false
      return true
    })
  }, [data, severityFilter, typeFilter])

  const grouped = useMemo(() => {
    const groups = {
      critical: filtered.filter((v) => v.severity === 'critical'),
      high: filtered.filter(
        (v) => v.severity === 'high' && v.level !== 'NEW',
      ),
      new: filtered.filter((v) => v.level === 'NEW'),
      moderate: filtered.filter((v) => v.severity === 'moderate'),
      disappeared: filtered.filter((v) => v.level === 'DISAPPEARED'),
    }
    return groups
  }, [filtered])

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card>
        <CardContent className="py-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Comparar:</label>
            <Select value={current} onValueChange={setCurrent}>
              <SelectTrigger className="w-auto min-w-[140px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {refOptions.map((ym) => (
                  <SelectItem key={ym} value={ym}>
                    {labelYM(ym)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">vs</span>
            <Select value={base} onValueChange={setBase}>
              <SelectTrigger className="w-auto min-w-[140px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {refOptions.map((ym) => (
                  <SelectItem key={ym} value={ym}>
                    {labelYM(ym)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Severidade:</label>
            <Select
              value={severityFilter}
              onValueChange={(v) => setSeverityFilter(v as SeverityFilter)}
            >
              <SelectTrigger className="w-auto min-w-[120px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="critical">Críticas</SelectItem>
                <SelectItem value="high">Altas</SelectItem>
                <SelectItem value="moderate">Moderadas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Tipo:</label>
            <Select
              value={typeFilter}
              onValueChange={(v) => setTypeFilter(v as TypeFilter)}
            >
              <SelectTrigger className="w-auto min-w-[140px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="increase">Aumentos</SelectItem>
                <SelectItem value="decrease">Quedas</SelectItem>
                <SelectItem value="new">Novas</SelectItem>
                <SelectItem value="disappeared">Sumiram</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto">
            <ExportReportButton
              relatorio="variancias"
              empresaId={empresaId}
              filtrosQS={new URLSearchParams({ current, base }).toString()}
              disabled={loading || !data}
            />
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
            <p className="text-sm">Detectando variâncias…</p>
          </CardContent>
        </Card>
      ) : !data ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="text-sm">Sem dados.</p>
          </CardContent>
        </Card>
      ) : data.variances.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Search className="h-8 w-8 mx-auto mb-2 text-primary/40" />
            <p className="text-sm font-medium">
              Sem variâncias relevantes entre os períodos
            </p>
            <p className="text-xs mt-2 max-w-md mx-auto">
              Todas as categorias ficaram estáveis (variação &lt; 15%) ou abaixo
              do threshold de materialidade (R$ {data.minAbsoluteValue.toLocaleString('pt-BR')}).
            </p>
            <p className="text-xs mt-1 text-muted-foreground">
              {data.totals.currentSum === 0 && data.totals.baseSum === 0
                ? 'Os 2 períodos selecionados não têm despesas categorizadas.'
                : `Comparando ${labelYM(data.periods.current.ym)} (${formatBRLCompact(data.totals.currentSum)}) com ${labelYM(data.periods.base.ym)} (${formatBRLCompact(data.totals.baseSum)})`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats 4 cards */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Críticas"
              count={data.summary.critical.count}
              impact={data.summary.critical.totalImpact}
              icon={AlertTriangle}
              tone="critical"
            />
            <StatCard
              label="Altas"
              count={data.summary.high.count}
              impact={data.summary.high.totalImpact}
              icon={TrendingUp}
              tone="high"
            />
            <StatCard
              label="Moderadas"
              count={data.summary.moderate.count}
              impact={data.summary.moderate.totalImpact}
              icon={TrendingDown}
              tone="moderate"
            />
            <StatCard
              label="Novas"
              count={data.summary.new.count}
              impact={data.summary.new.totalImpact}
              icon={Sparkles}
              tone="new"
            />
          </div>

          {/* Seções */}
          {grouped.critical.length > 0 && (
            <Section
              title="🚨 Atenção imediata — Variações críticas"
              variances={grouped.critical}
              periods={data.periods}
            />
          )}
          {grouped.high.length > 0 && (
            <Section
              title="⚠️ Atenção — Variações altas"
              variances={grouped.high}
              periods={data.periods}
            />
          )}
          {grouped.new.length > 0 && (
            <Section
              title="✨ Novidades — Apareceram este mês"
              variances={grouped.new}
              periods={data.periods}
            />
          )}
          {grouped.moderate.length > 0 && (
            <Section
              title="📊 Moderadas"
              variances={grouped.moderate}
              periods={data.periods}
            />
          )}
          {grouped.disappeared.length > 0 && (
            <Section
              title="🛑 Sumiram — Categorias do mês anterior sem movimento"
              variances={grouped.disappeared}
              periods={data.periods}
            />
          )}
          {filtered.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <p className="text-sm">
                  Nenhuma variância bate com os filtros selecionados.
                </p>
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
  count,
  impact,
  icon: Icon,
  tone,
}: {
  label: string
  count: number
  impact: number
  icon: typeof TrendingUp
  tone: 'critical' | 'high' | 'moderate' | 'new'
}) {
  const toneClasses = {
    critical: 'text-red-600 dark:text-red-400',
    high: 'text-amber-600 dark:text-amber-400',
    moderate: 'text-yellow-600 dark:text-yellow-400',
    new: 'text-purple-600 dark:text-purple-400',
  }
  const sign = impact >= 0 ? '+' : ''
  return (
    <Card>
      <CardContent className="py-3">
        <div className={`flex items-center gap-2 ${toneClasses[tone]}`}>
          <Icon className="h-4 w-4 shrink-0" />
          <p className="text-[10px] uppercase tracking-wider font-medium">
            {label}
          </p>
        </div>
        <p className={`text-2xl font-bold tabular-nums mt-1 ${toneClasses[tone]}`}>
          {count}
        </p>
        {count > 0 && (
          <p className={`text-xs tabular-nums mt-0.5 ${toneClasses[tone]}`}>
            {sign}
            {formatBRLCompact(impact)}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function Section({
  title,
  variances,
  periods,
}: {
  title: string
  variances: VarianceResult[]
  periods: ApiResponse['periods']
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {variances.map((v) => (
          <VarianceCard key={v.categoryId} variance={v} periods={periods} />
        ))}
      </div>
    </div>
  )
}

function VarianceCard({
  variance,
  periods,
}: {
  variance: VarianceResult
  periods: ApiResponse['periods']
}) {
  const visual = VARIANCE_LEVEL_VISUAL[variance.level]
  const classes = classesForLevel(variance.level, variance.severity)
  const sign = variance.variationAbs >= 0 ? '+' : ''

  return (
    <div
      className={`rounded-xl border p-4 ${classes.cardClass} transition-all hover:shadow-md`}
      data-testid={`variance-card-${variance.categoryId}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <Badge className={`${classes.badgeClass} text-[10px] uppercase`}>
          {visual.symbol} {visual.label}
        </Badge>
        <p
          className={`text-sm font-bold tabular-nums ${classes.textClass} whitespace-nowrap`}
        >
          {sign}
          {formatBRLCompact(variance.variationAbs)}
        </p>
      </div>

      <h4 className="text-sm font-semibold text-foreground truncate">
        {variance.categoryName}
      </h4>
      {variance.dreGroup && (
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {dreGroupLabel(variance.dreGroup)}
        </p>
      )}

      <div className="mt-3 space-y-1 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">
            {labelYM(periods.current.ym).split('/')[0]}
          </span>
          <span className="tabular-nums font-medium">
            {formatBRL(variance.currentAmount)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">
            {labelYM(periods.base.ym).split('/')[0]}
          </span>
          <span className="tabular-nums text-muted-foreground">
            {formatBRL(variance.baseAmount)}
          </span>
        </div>
        {variance.variationPct !== null && (
          <div className="flex items-center justify-between pt-1 border-t border-current/10">
            <span className="text-muted-foreground">Variação</span>
            <span className={`tabular-nums font-bold ${classes.textClass}`}>
              {variance.variationPct >= 0 ? '+' : ''}
              {variance.variationPct.toFixed(1)}%
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
