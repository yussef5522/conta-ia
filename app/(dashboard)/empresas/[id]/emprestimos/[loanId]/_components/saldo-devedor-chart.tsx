// Gráfico de saldo devedor ao longo do contrato — Recharts AreaChart.
'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { formatBRL } from '@/lib/format/money'

interface Point {
  x: number
  label: string
  saldoDevedor: number
}

export function SaldoDevedorChart({ points }: { points: Point[] }) {
  if (points.length === 0) return <div className="h-48 text-center text-muted-foreground text-sm">Sem dados</div>

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <AreaChart data={points} margin={{ top: 10, right: 5, left: 5, bottom: 5 }}>
          <defs>
            <linearGradient id="gradSaldo" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis
            dataKey="x"
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            stroke="hsl(var(--muted-foreground))"
          />
          <YAxis
            tickFormatter={(v) =>
              `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}k`
            }
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            stroke="hsl(var(--muted-foreground))"
            width={50}
          />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              border: '1px solid hsl(var(--border))',
              borderRadius: 6,
              backgroundColor: 'hsl(var(--background))',
            }}
            labelFormatter={(label, payload) =>
              payload?.[0]?.payload?.label
                ? `Parcela ${label} — ${payload[0].payload.label}`
                : `Parcela ${label}`
            }
            formatter={(value) => [formatBRL(Number(value)), 'Saldo devedor']}
          />
          <Area
            type="monotone"
            dataKey="saldoDevedor"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            fill="url(#gradSaldo)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
