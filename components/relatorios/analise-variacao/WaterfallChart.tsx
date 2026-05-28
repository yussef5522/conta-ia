'use client'

// Sprint Análise de Variação (28/05/2026) — Waterfall chart.
// Stacked Bar (base invisível + value colorido) via Recharts.

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { WaterfallBar } from '@/lib/relatorios/analise-variacao'

interface Props {
  bars: WaterfallBar[]
  height?: number
}

const COLORS = {
  inicio: '#475569', // slate-600
  fim: '#1e3a8a', // blue-900
  aumento: '#ef4444', // red-500
  reducao: '#10b981', // emerald-500
}

function formatBRLCompact(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace('.', ',')}M`
  if (abs >= 1_000) return `R$ ${(v / 1_000).toFixed(1).replace('.', ',')}k`
  return `R$ ${v.toFixed(0)}`
}

function formatBRL(v: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  }).format(v)
}

export function WaterfallChart({ bars, height = 380 }: Props) {
  if (bars.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
        Sem dados pra exibir.
      </div>
    )
  }

  return (
    <div style={{ height }} data-testid="waterfall-chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={bars}
          margin={{ top: 20, right: 20, bottom: 50, left: 16 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#e2e8f0"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            stroke="#64748b"
            fontSize={11}
            angle={-30}
            textAnchor="end"
            interval={0}
            height={60}
          />
          <YAxis
            stroke="#64748b"
            fontSize={11}
            tickFormatter={(v: number) =>
              Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
            }
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(15, 23, 42, 0.95)',
              border: 'none',
              borderRadius: 8,
              fontSize: 12,
              color: '#fff',
            }}
            formatter={(_value, _name, item) => {
              // item.payload tem o WaterfallBar
              const p = item.payload as WaterfallBar
              if (p.tipo === 'inicio' || p.tipo === 'fim') {
                return [formatBRL(p.value), p.label]
              }
              const sinal = p.delta >= 0 ? '+' : ''
              return [`${sinal}${formatBRL(p.delta)}`, 'Impacto']
            }}
            labelFormatter={(label) => String(label)}
          />
          {/* Base invisível (stacked) */}
          <Bar dataKey="base" stackId="wf" fill="transparent" />
          {/* Value colorido */}
          <Bar dataKey="value" stackId="wf" radius={[4, 4, 0, 0]}>
            {bars.map((b, i) => (
              <Cell key={i} fill={COLORS[b.tipo]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
