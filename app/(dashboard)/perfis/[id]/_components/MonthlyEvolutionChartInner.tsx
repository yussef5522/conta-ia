'use client'

// Sprint Dashboard PF — ComposedChart 12 meses (barras + linha).

import {
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Legend,
} from 'recharts'
import type { MonthlyEvolutionPoint } from '@/lib/dashboard-pf/types'
import { formatBRL } from '@/lib/format/money'

interface InnerProps {
  data: MonthlyEvolutionPoint[]
  height?: number
}

function tooltipFormatter(value: unknown, name: unknown): [string, string] {
  const n = typeof value === 'number' ? value : 0
  const nameStr = String(name)
  const label =
    nameStr === 'income' ? 'Entradas'
    : nameStr === 'expense' ? 'Saídas'
    : nameStr === 'cumulativeBalance' ? 'Saldo'
    : nameStr
  return [formatBRL(n), label]
}

export default function MonthlyEvolutionChartInner({ data, height = 280 }: InnerProps) {
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 12, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false}
            axisLine={{ stroke: '#cbd5e1' }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) =>
              v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(0)
            }
          />
          <Tooltip
            formatter={tooltipFormatter}
            contentStyle={{
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              fontSize: 12,
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 6 }}
            iconType="circle"
            iconSize={8}
          />
          <Bar dataKey="income" name="Entradas" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={28} />
          <Bar dataKey="expense" name="Saídas" fill="#ef4444" radius={[3, 3, 0, 0]} maxBarSize={28} />
          <Line
            type="monotone"
            dataKey="cumulativeBalance"
            name="Saldo"
            stroke="#185FA5"
            strokeWidth={2}
            dot={{ r: 3, fill: '#185FA5' }}
            activeDot={{ r: 5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
