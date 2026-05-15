'use client'

// Gráfico waterfall (Recharts) — Sprint 2 Dia 1.
// Técnica: BarChart com 2 séries stacked — uma transparente (offset/displayBase)
// + uma colorida (displayValue). Barras de saldo são âncoras; entradas/saídas
// flutuam a partir do running total.

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { WaterfallBar } from '@/lib/dashboard/compute-waterfall'
import { formatBRL } from '@/lib/format/money'

interface CashflowWaterfallChartProps {
  bars: WaterfallBar[]
  totalEntradas: number
  totalSaidas: number
}

interface TooltipPayloadEntry {
  payload: WaterfallBar & { totalEntradas: number; totalSaidas: number }
}

function WaterfallTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: TooltipPayloadEntry[]
}) {
  if (!active || !payload || payload.length === 0) return null
  const bar = payload[0].payload
  const isIncome = bar.kind === 'income'
  const isExpense = bar.kind === 'expense'

  // % sobre o lado (entradas ou saídas)
  let pctLado: string | null = null
  if (isIncome && bar.totalEntradas > 0) {
    pctLado = `${Math.round((bar.rawValue / bar.totalEntradas) * 100)}% das entradas`
  } else if (isExpense && bar.totalSaidas > 0) {
    pctLado = `${Math.round((bar.rawValue / bar.totalSaidas) * 100)}% das saídas`
  }

  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="font-semibold">{bar.label}</p>
      <p className="tabular-nums mt-0.5">{formatBRL(bar.rawValue)}</p>
      {pctLado && <p className="text-xs text-muted-foreground mt-0.5">{pctLado}</p>}
    </div>
  )
}

export default function CashflowWaterfallChart({
  bars,
  totalEntradas,
  totalSaidas,
}: CashflowWaterfallChartProps) {
  // Enriquece cada barra com os totais (pro tooltip calcular %)
  const data = bars.map((b) => ({ ...b, totalEntradas, totalSaidas }))

  return (
    <div className="w-full" style={{ height: 320 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11 }}
            interval={0}
            angle={-15}
            textAnchor="end"
            height={50}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(v: number) => formatBRL(v)}
            width={90}
          />
          <Tooltip
            content={<WaterfallTooltip />}
            cursor={{ fill: 'var(--muted)', opacity: 0.3 }}
          />
          {/* Série 1: offset transparente (base da barra) */}
          <Bar dataKey="displayBase" stackId="wf" fill="transparent" isAnimationActive={false} />
          {/* Série 2: barra colorida visível.
              TODO Sprint 2 Dia 2: onClick → drill-down pra /transacoes filtrado */}
          <Bar
            dataKey="displayValue"
            stackId="wf"
            radius={[3, 3, 0, 0]}
            isAnimationActive={false}
            className="cursor-pointer"
          >
            {data.map((b) => (
              <Cell key={b.id} fill={b.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
