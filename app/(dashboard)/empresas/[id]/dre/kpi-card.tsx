'use client'

// Card de KPI reutilizável (Sub-etapa 5.4.C).
// Suporta 3 formatadores (brl/percent/percent_pp), tipos de tendência
// (revenue/expense/margin/percentage), tooltip educativo e warning.

import { TrendingUp, TrendingDown, Minus, AlertTriangle, Info } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatBRL, formatPercent, formatPercentSigned } from '@/lib/format/dre'
import type { KPIWithVariation, KPITrendType } from '@/lib/dre/kpis'
import { getVariationColor } from '@/lib/dre/kpis'

type Formatter = 'brl' | 'percent' | 'percent_pp'

interface KPICardProps {
  label: string
  data: KPIWithVariation
  formatter: Formatter
  trendType: KPITrendType
  tooltip?: string
  size?: 'default' | 'large'
}

export function KPICard({
  label,
  data,
  formatter,
  trendType,
  tooltip,
  size = 'default',
}: KPICardProps) {
  const formattedValue = formatValue(data.value, formatter)
  const variationDisplay = formatVariation(data, formatter)
  const colorClass = getColorClass(trendType, data.variationPct)
  const Icon = getTrendIcon(data.variationPct)

  return (
    <Card className={`p-4 relative ${size === 'large' ? 'md:p-6' : ''}`}>
      {/* Tooltip educativo no canto superior direito */}
      {tooltip && (
        <div className="absolute top-2 right-2 group">
          <Info className="h-3 w-3 text-muted-foreground/50 cursor-help" />
          <div className="invisible group-hover:visible absolute right-0 top-5 z-20 w-64 p-3 rounded-lg bg-popover text-popover-foreground border shadow-lg text-xs leading-relaxed pointer-events-none">
            {tooltip}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider pr-6">
        {label}
      </p>

      <p
        className={`mt-2 ${size === 'large' ? 'text-3xl' : 'text-2xl'} font-bold tabular-nums`}
      >
        {formattedValue}
      </p>

      {variationDisplay && (
        <div className={`mt-1.5 flex items-center gap-1 text-xs font-medium ${colorClass}`}>
          <Icon className="h-3 w-3" />
          <span>{variationDisplay}</span>
        </div>
      )}

      {data.warning && (
        <Badge
          variant="outline"
          className="mt-2 text-xs border-orange-300 text-orange-700 dark:text-orange-300 dark:border-orange-700"
        >
          <AlertTriangle className="h-2.5 w-2.5 mr-1" />
          {data.warning}
        </Badge>
      )}
    </Card>
  )
}

function formatValue(value: number | null, formatter: Formatter): string {
  if (value === null || !isFinite(value)) return '—'
  if (formatter === 'brl') return formatBRL(value)
  if (formatter === 'percent') return formatPercent(value)
  if (formatter === 'percent_pp') return formatPercent(value)
  return String(value)
}

function formatVariation(data: KPIWithVariation, formatter: Formatter): string | null {
  if (data.variationPct === null) return null
  if (!isFinite(data.variationPct)) return null

  // Pra valores de R$ e %: mostra % de variação
  if (formatter === 'brl' || formatter === 'percent') {
    return formatPercentSigned(data.variationPct)
  }

  // Pra percent_pp (ex: margemLiquidaDelta): mostra delta em pontos percentuais
  if (formatter === 'percent_pp') {
    const sign = data.variationPct > 0 ? '+' : ''
    return `${sign}${data.variationPct.toFixed(1).replace('.', ',')}pp`
  }

  return null
}

function getColorClass(type: KPITrendType, variationPct: number | null): string {
  const color = getVariationColor(type, variationPct)
  if (color === 'positive') return 'text-emerald-700 dark:text-emerald-400'
  if (color === 'negative') return 'text-rose-700 dark:text-rose-400'
  return 'text-muted-foreground'
}

function getTrendIcon(variationPct: number | null) {
  if (variationPct === null || variationPct === 0) return Minus
  return variationPct > 0 ? TrendingUp : TrendingDown
}
