'use client'

// Gráfico waterfall (Recharts) — Sprint 2 Dia 1 + polish Dia 2.
//
// Dia 1: BarChart com 2 séries stacked (offset transparente + valor colorido).
// Dia 2:
//   - Linhas conectoras tracejadas via <Customized> (técnica canônica Recharts)
//   - Drill-down: click numa barra de fluxo → /transacoes filtrado
//   - Animação só no 1º render da sessão (sessionStorage) + prefers-reduced-motion
//   - Hover state refinado (activeBar)

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bar,
  BarChart,
  Cell,
  Customized,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { WaterfallBar } from '@/lib/dashboard/compute-waterfall'
import {
  buildWaterfallDrillDownUrl,
  computeConnectorSegments,
} from '@/lib/dashboard/waterfall-drilldown'
import { formatBRL } from '@/lib/format/money'

interface CashflowWaterfallChartProps {
  bars: WaterfallBar[]
  totalEntradas: number
  totalSaidas: number
  // Período (pro drill-down filtrar /transacoes). Datas já reidratadas no server.
  periodStart: string // ISO
  periodEnd: string // ISO
}

interface BarDatum extends WaterfallBar {
  totalEntradas: number
  totalSaidas: number
}

// ============================================================
// Tooltip
// ============================================================

function WaterfallTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: BarDatum }>
}) {
  if (!active || !payload || payload.length === 0) return null
  const bar = payload[0].payload
  const isIncome = bar.kind === 'income'
  const isExpense = bar.kind === 'expense'

  let pctLado: string | null = null
  if (isIncome && bar.totalEntradas > 0) {
    pctLado = `${Math.round((bar.rawValue / bar.totalEntradas) * 100)}% das entradas`
  } else if (isExpense && bar.totalSaidas > 0) {
    pctLado = `${Math.round((bar.rawValue / bar.totalSaidas) * 100)}% das saídas`
  }

  // Refino Dia 2: tooltip de barra clicável avisa o que o click faz
  const clickHint = isIncome
    ? 'Clique para ver as entradas do período'
    : isExpense
      ? 'Clique para ver as saídas do período'
      : null

  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-md animate-in fade-in-0 duration-150">
      <p className="font-semibold">{bar.label}</p>
      <p className="tabular-nums mt-0.5">{formatBRL(bar.rawValue)}</p>
      {pctLado && <p className="text-xs text-muted-foreground mt-0.5">{pctLado}</p>}
      {clickHint && (
        <p className="text-xs text-primary mt-1">{clickHint}</p>
      )}
    </div>
  )
}

// ============================================================
// Linhas conectoras — <Customized> recebe o estado interno do Recharts
// (xAxisMap/yAxisMap com as escalas já calculadas).
// ============================================================

interface ConnectorsProps {
  // Props injetadas pelo Recharts no <Customized>. Tipagem da lib é fraca aqui;
  // usamos `unknown` + narrowing defensivo. Se a estrutura mudar, o fallback
  // (try/catch) garante que o gráfico ainda renderiza sem as linhas.
  xAxisMap?: Record<string, { scale?: (v: unknown) => number }>
  yAxisMap?: Record<string, { scale?: (v: number) => number }>
  data?: BarDatum[]
}

function Connectors(props: ConnectorsProps) {
  try {
    const { xAxisMap, yAxisMap, data } = props
    if (!xAxisMap || !yAxisMap || !data || data.length < 2) return null

    const xAxis = Object.values(xAxisMap)[0]
    const yAxis = Object.values(yAxisMap)[0]
    const xScale = xAxis?.scale
    const yScale = yAxis?.scale
    if (typeof xScale !== 'function' || typeof yScale !== 'function') return null

    // bandwidth da escala categórica do X
    const bandwidth =
      'bandwidth' in xScale && typeof xScale.bandwidth === 'function'
        ? (xScale.bandwidth as () => number)()
        : 0

    const segments = computeConnectorSegments(data)

    return (
      <g>
        {segments.map((seg) => {
          const fromLabel = data[seg.fromIndex].label
          const toLabel = data[seg.toIndex].label
          const x1 = (xScale(fromLabel) as number) + bandwidth
          const x2 = xScale(toLabel) as number
          const y = yScale(seg.y) as number
          if ([x1, x2, y].some((n) => typeof n !== 'number' || isNaN(n))) return null
          return (
            <line
              key={`${seg.fromIndex}-${seg.toIndex}`}
              x1={x1}
              y1={y}
              x2={x2}
              y2={y}
              stroke="var(--muted-foreground)"
              strokeOpacity={0.4}
              strokeWidth={1}
              strokeDasharray="4 4"
            />
          )
        })}
      </g>
    )
  } catch {
    // Fallback: se a API interna do Recharts mudar, gráfico renderiza sem linhas
    return null
  }
}

// ============================================================
// Componente principal
// ============================================================

// Decide se anima: só no 1º render da sessão + respeita prefers-reduced-motion.
function shouldAnimateOnce(): boolean {
  if (typeof window === 'undefined') return false
  const prefersReduced = window.matchMedia?.(
    '(prefers-reduced-motion: reduce)',
  ).matches
  if (prefersReduced) return false
  const KEY = 'waterfall-animated'
  if (window.sessionStorage.getItem(KEY)) return false
  window.sessionStorage.setItem(KEY, '1')
  return true
}

export default function CashflowWaterfallChart({
  bars,
  totalEntradas,
  totalSaidas,
  periodStart,
  periodEnd,
}: CashflowWaterfallChartProps) {
  const router = useRouter()
  // Avaliado uma vez no mount — toggle de período não re-anima
  const [animate] = useState<boolean>(() => shouldAnimateOnce())

  const data: BarDatum[] = useMemo(
    () => bars.map((b) => ({ ...b, totalEntradas, totalSaidas })),
    [bars, totalEntradas, totalSaidas],
  )

  const period = useMemo(
    () => ({ startDate: new Date(periodStart), endDate: new Date(periodEnd) }),
    [periodStart, periodEnd],
  )

  function handleBarClick(datum: BarDatum) {
    const url = buildWaterfallDrillDownUrl(datum, period)
    if (url) router.push(url)
  }

  return (
    <div
      className="w-full"
      style={{ height: 320 }}
      role="img"
      aria-label={`Fluxo de caixa do período: entradas ${formatBRL(totalEntradas)}, saídas ${formatBRL(totalSaidas)}`}
    >
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
          <Bar
            dataKey="displayBase"
            stackId="wf"
            fill="transparent"
            isAnimationActive={false}
          />
          {/* Série 2: barra colorida visível + drill-down + hover refinado */}
          <Bar
            dataKey="displayValue"
            stackId="wf"
            radius={[3, 3, 0, 0]}
            isAnimationActive={animate}
            animationDuration={500}
            onClick={(d: unknown) => handleBarClick(d as BarDatum)}
            activeBar={{ stroke: 'var(--foreground)', strokeOpacity: 0.25, strokeWidth: 1 }}
          >
            {data.map((b) => {
              const clickable = b.kind === 'income' || b.kind === 'expense'
              return (
                <Cell
                  key={b.id}
                  fill={b.color}
                  className={clickable ? 'cursor-pointer' : 'cursor-default'}
                />
              )
            })}
          </Bar>
          {/* Linhas conectoras tracejadas (técnica <Customized>) */}
          <Customized component={Connectors as never} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
