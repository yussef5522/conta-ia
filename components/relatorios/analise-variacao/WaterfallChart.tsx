'use client'

// Sprint Waterfall Redesign McKinsey (28/05/2026)
//
// Redesign completo do waterfall pra nível profissional FP&A:
// - Bar shape custom com connector tracejado entre barras consecutivas
// - Data labels (R$ com sinal) em cada barra
// - Cores saturadas (red-600/green-600) + destaque TOP 1 (red-800/green-800)
// - YAxis com zoom (não começa em 0) — drivers ficam visíveis
// - Grid removido + YAxis hide + nomes truncados + ângulo -30°
// - Aritmética preservada (selecionarDriversVisuais separa visíveis × outros)

import {
  Bar,
  BarChart,
  CartesianGrid,
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

// ─────────────────────────────────────────
// Cores saturadas (decisão Yussef): red-600/green-600
// TOP 1 driver ganha cor um shade mais forte (red-800/green-800)
// ─────────────────────────────────────────
const CORES = {
  total: '#1e293b', // slate-800 (início/fim)
  aumento: '#dc2626', // red-600
  aumentoDestaque: '#991b1b', // red-800 (TOP 1)
  reducao: '#16a34a', // green-600
  reducaoDestaque: '#166534', // green-800 (TOP 1)
  outros: '#64748b', // slate-500
} as const

function formatBRL(v: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  }).format(v)
}

/** Compacto pra data labels (cabe em barra pequena). */
function formatBRLCompact(v: number, withSign = false): string {
  const abs = Math.abs(v)
  const sign = withSign && v >= 0 ? '+' : v < 0 ? '-' : ''
  if (abs >= 1_000_000) {
    return `${sign}R$ ${(abs / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}M`
  }
  if (abs >= 1_000) {
    return `${sign}R$ ${(abs / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k`
  }
  return `${sign}R$ ${abs.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
}

function truncateLabel(s: string, max = 18): string {
  if (s.length <= max) return s
  return s.slice(0, max - 1) + '…'
}

/** Identifica TOP 1 driver (maior |delta|), excluindo Início/Fim/Outros. */
function findTopDriverIndex(bars: WaterfallBar[]): number {
  let topIdx = -1
  let topMag = 0
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i]
    if (b.tipo !== 'aumento' && b.tipo !== 'reducao') continue
    if (b.isOutros) continue
    const mag = Math.abs(b.delta)
    if (mag > topMag) {
      topMag = mag
      topIdx = i
    }
  }
  return topIdx
}

// ─────────────────────────────────────────
// Bar shape custom: retângulo + connector + data label
// ─────────────────────────────────────────

interface BarShapeProps {
  x?: number
  y?: number
  width?: number
  height?: number
  payload?: WaterfallBar
  index?: number
  // Props extras passadas via closure
  allBars: WaterfallBar[]
  topDriverIdx: number
}

function WaterfallBarShape(props: BarShapeProps) {
  const {
    x = 0,
    y = 0,
    width = 0,
    height = 0,
    payload,
    index = 0,
    allBars,
    topDriverIdx,
  } = props

  if (!payload) return null

  // Cor por tipo + destaque TOP 1
  let fill: string
  if (payload.tipo === 'inicio' || payload.tipo === 'fim') {
    fill = CORES.total
  } else if (payload.isOutros) {
    fill = CORES.outros
  } else if (payload.tipo === 'aumento') {
    fill = index === topDriverIdx ? CORES.aumentoDestaque : CORES.aumento
  } else if (payload.tipo === 'reducao') {
    fill = index === topDriverIdx ? CORES.reducaoDestaque : CORES.reducao
  } else {
    fill = CORES.outros
  }

  // Data label
  const labelText =
    payload.tipo === 'inicio' || payload.tipo === 'fim'
      ? formatBRLCompact(payload.value)
      : formatBRLCompact(payload.delta, true)

  // Connector: linha pontilhada horizontal saindo do topo da barra
  // até o final do "slot" da próxima barra. Não tentamos calcular o Y
  // exato da próxima (Recharts não expõe scale aqui); usamos linha
  // horizontal saindo do topo desta — o efeito visual é "step ladder"
  // típico de waterfall McKinsey.
  const showConnector = allBars[index + 1] !== undefined
  const xGap = width * 0.15 // Recharts barCategoryGap default

  return (
    <g>
      {/* Retângulo principal */}
      <rect x={x} y={y} width={width} height={height} fill={fill} rx={2} />

      {/* Connector tracejado horizontal do topo da barra atual */}
      {showConnector && (
        <line
          x1={x + width}
          y1={y}
          x2={x + width + xGap}
          y2={y}
          stroke="#94a3b8"
          strokeWidth={1.2}
          strokeDasharray="3 3"
          opacity={0.6}
        />
      )}

      {/* Data label */}
      <text
        x={x + width / 2}
        y={y - 6}
        textAnchor="middle"
        fontSize={11}
        fontWeight={
          index === topDriverIdx ||
          payload.tipo === 'inicio' ||
          payload.tipo === 'fim'
            ? 700
            : 600
        }
        fill={fill}
      >
        {labelText}
      </text>
    </g>
  )
}

// ─────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────

export function WaterfallChart({ bars, height = 420 }: Props) {
  if (bars.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
        Sem dados pra exibir.
      </div>
    )
  }

  // Y domain com zoom: começa próximo do menor valor, termina acima do
  // maior. Padding 15% pra não cortar labels e dar respiro visual.
  const allYs = bars.flatMap((b) => [b.base, b.end])
  const minY = Math.min(...allYs)
  const maxY = Math.max(...allYs)
  const padding = (maxY - minY) * 0.15
  const yDomainStart = Math.max(0, minY - padding)
  const yDomainEnd = maxY + padding

  const topDriverIdx = findTopDriverIndex(bars)

  return (
    <div style={{ height }} data-testid="waterfall-chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={bars}
          margin={{ top: 40, right: 20, bottom: 12, left: 12 }}
        >
          {/* Grid removido — limpa visual McKinsey */}
          <CartesianGrid stroke="none" />

          <XAxis
            dataKey="label"
            tickFormatter={(label: string) => truncateLabel(String(label))}
            stroke="#64748b"
            fontSize={11}
            angle={-30}
            textAnchor="end"
            interval={0}
            height={80}
            axisLine={false}
            tickLine={false}
          />

          {/* YAxis com zoom mas hide — labels nas barras compensam */}
          <YAxis hide domain={[yDomainStart, yDomainEnd]} />

          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(15, 23, 42, 0.95)',
              border: 'none',
              borderRadius: 8,
              fontSize: 12,
              color: '#fff',
            }}
            cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
            formatter={(_value, _name, item) => {
              const p = item.payload as WaterfallBar
              if (p.tipo === 'inicio' || p.tipo === 'fim') {
                return [formatBRL(p.value), p.label]
              }
              const sinal = p.delta >= 0 ? '+' : ''
              return [`${sinal}${formatBRL(p.delta)}`, 'Impacto']
            }}
            labelFormatter={(label) => String(label)}
          />

          {/* Base invisível pro stacked offset */}
          <Bar dataKey="base" stackId="wf" fill="transparent" />

          {/* Value colorido com shape custom (cor + connector + label) */}
          <Bar
            dataKey="value"
            stackId="wf"
            shape={(props: unknown) => (
              <WaterfallBarShape
                {...(props as Omit<
                  BarShapeProps,
                  'allBars' | 'topDriverIdx'
                >)}
                allBars={bars}
                topDriverIdx={topDriverIdx}
              />
            )}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
