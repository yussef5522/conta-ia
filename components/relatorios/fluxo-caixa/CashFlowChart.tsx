'use client'

// Sprint 5.0.4.0b Fase 3 — Gráfico Recharts ComposedChart.
// Barras verde (income, acima de 0) + barras vermelho (expense, acima de 0)
// + Linha azul "saldo acumulado" sobreposta.

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface MonthlyRow {
  monthKey: string
  income: number
  expense: number
  saldoAcumulado: number
}

interface Props {
  data: MonthlyRow[]
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
  const [y, m] = monthKey.split('-').map(Number)
  return `${MES_SHORT[m - 1]}/${String(y).slice(-2)}`
}

function formatBRL(v: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(v)
}

const COLORS = {
  income: '#10b981', // emerald-500
  expense: '#ef4444', // red-500
  saldo: '#3b82f6', // blue-500
}

export function CashFlowChart({ data, height = 320 }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
        Sem dados no período.
      </div>
    )
  }

  return (
    <div style={{ height }} data-testid="cashflow-chart">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 12, right: 16, bottom: 8, left: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="monthKey"
            tickFormatter={formatMonth}
            stroke="#64748b"
            fontSize={11}
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
            labelFormatter={(label) =>
              typeof label === 'string' ? formatMonth(label) : String(label)
            }
            formatter={(value, name) => {
              const labels: Record<string, string> = {
                income: 'Entradas',
                expense: 'Saídas',
                saldoAcumulado: 'Saldo acumulado',
              }
              const v = typeof value === 'number' ? formatBRL(value) : String(value)
              return [v, labels[String(name)] ?? String(name)]
            }}
          />
          <Legend
            iconType="circle"
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            formatter={(value: string) => {
              const labels: Record<string, string> = {
                income: 'Entradas',
                expense: 'Saídas',
                saldoAcumulado: 'Saldo acumulado',
              }
              return labels[value] ?? value
            }}
          />
          <Bar
            dataKey="income"
            fill={COLORS.income}
            radius={[4, 4, 0, 0]}
            maxBarSize={48}
          />
          <Bar
            dataKey="expense"
            fill={COLORS.expense}
            radius={[4, 4, 0, 0]}
            maxBarSize={48}
          />
          <Line
            type="monotone"
            dataKey="saldoAcumulado"
            stroke={COLORS.saldo}
            strokeWidth={2.5}
            dot={{ r: 3, fill: COLORS.saldo }}
            activeDot={{ r: 5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
