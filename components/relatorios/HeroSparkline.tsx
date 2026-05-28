'use client'

// Sprint 5.0.4.0b — Sparkline do Hero Card (Recharts AreaChart).
// Wrapper Client (dynamic ssr:false NÃO pode ser usado em Server Component
// no Next 16 — padrão Sprint 1).

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { SparklinePoint } from '@/lib/relatorios/preview-queries'

interface Props {
  data: SparklinePoint[]
  /** "positive" = verde (lucro saudável) · "negative" = vermelho */
  variant?: 'positive' | 'negative' | 'neutral'
  height?: number
}

const MES_SHORT = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
]

function formatMonth(monthKey: string): string {
  // "2026-05" → "Mai/26"
  const [y, m] = monthKey.split('-').map(Number)
  return `${MES_SHORT[m - 1]}/${String(y).slice(-2)}`
}

function formatBRLCompact(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}k`
  return `R$ ${v.toFixed(0)}`
}

export function HeroSparkline({
  data,
  variant = 'positive',
  height = 80,
}: Props) {
  if (data.length < 3) return null

  const colorMap = {
    positive: { stroke: '#34d399', fill: '#34d399' }, // emerald-400
    negative: { stroke: '#f87171', fill: '#f87171' }, // red-400
    neutral: { stroke: '#a5b4fc', fill: '#a5b4fc' }, // indigo-300
  }
  const colors = colorMap[variant]
  const gradientId = `sparkGradient-${variant}`

  return (
    <div style={{ height }} aria-label="Sparkline de Lucro Líquido por mês">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.fill} stopOpacity={0.35} />
              <stop offset="100%" stopColor={colors.fill} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="monthKey" hide />
          <YAxis hide domain={['auto', 'auto']} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(15, 23, 42, 0.95)',
              border: 'none',
              borderRadius: 8,
              fontSize: 12,
              color: '#fff',
            }}
            labelFormatter={(label) =>
              typeof label === 'string' ? formatMonth(label) : String(label)
            }
            formatter={(value) => [
              typeof value === 'number' ? formatBRLCompact(value) : String(value),
              'Lucro',
            ]}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={colors.stroke}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
