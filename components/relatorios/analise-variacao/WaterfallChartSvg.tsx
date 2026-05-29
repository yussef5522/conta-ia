'use client'

// Hotfix Waterfall SVG Custom (28/05/2026) — 2ª tentativa pós-feedback Yussef.
//
// SVG puro (sem Recharts) pra resolver as limitações estruturais:
// - Connectors DIAGONAIS reais (topo→início próxima) — Recharts não permitia
// - Escala adaptativa (NÃO inclui zero) — drivers ficam visíveis
// - Layout limpo McKinsey: grid removido, Y axis hide, labels nas barras
// - Top 6 + threshold 8% + mín 4 (Yussef pediu enxuto)
//
// scaleLinear/scaleBand implementados manualmente (sem d3-scale, ~30 linhas).

import { useState } from 'react'
import type { WaterfallBar } from '@/lib/relatorios/analise-variacao'

interface Props {
  bars: WaterfallBar[]
  width?: number
  height?: number
  /**
   * Sprint Drill-Down (29/05/2026) — callback ao clicar numa barra de
   * driver (não inicio/fim/outros). Recebe a barra clicada pra montar
   * o filtro do modal.
   */
  onBarClick?: (bar: WaterfallBar) => void
}

// ─────────────────────────────────────────
// Scales manuais (~30 linhas, sem d3-scale)
// ─────────────────────────────────────────

function scaleLinear(d0: number, d1: number, r0: number, r1: number) {
  if (d1 === d0) return () => r0
  const m = (r1 - r0) / (d1 - d0)
  return (x: number) => r0 + m * (x - d0)
}

interface BandSlot {
  x: number
  width: number
  center: number
}

function scaleBand(
  n: number,
  r0: number,
  r1: number,
  padding = 0.35,
): (i: number) => BandSlot {
  const range = r1 - r0
  const step = range / n
  const bandwidth = step * (1 - padding)
  const offset = (step - bandwidth) / 2
  return (i: number) => {
    const x = r0 + i * step + offset
    return { x, width: bandwidth, center: x + bandwidth / 2 }
  }
}

// ─────────────────────────────────────────
// Cores saturadas (decisão Yussef): red-600/green-600
// TOP 1 driver ganha cor um shade mais forte
// ─────────────────────────────────────────

const CORES = {
  total: '#1e293b', // slate-800
  aumento: '#dc2626', // red-600
  aumentoDestaque: '#991b1b', // red-800 (TOP 1)
  reducao: '#16a34a', // green-600
  reducaoDestaque: '#166534', // green-800 (TOP 1)
  outros: '#94a3b8', // slate-400
} as const

function corDaBarra(b: WaterfallBar, isTop: boolean): string {
  if (b.tipo === 'inicio' || b.tipo === 'fim') return CORES.total
  if (b.isOutros) return CORES.outros
  const aumento = b.tipo === 'aumento'
  if (isTop) {
    return aumento ? CORES.aumentoDestaque : CORES.reducaoDestaque
  }
  return aumento ? CORES.aumento : CORES.reducao
}

function findTopDriverIndex(bars: WaterfallBar[]): number {
  let idx = -1
  let mag = 0
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i]
    if (b.tipo !== 'aumento' && b.tipo !== 'reducao') continue
    if (b.isOutros) continue
    const m = Math.abs(b.delta)
    if (m > mag) {
      mag = m
      idx = i
    }
  }
  return idx
}

function formatLabel(b: WaterfallBar): string {
  if (b.tipo === 'inicio' || b.tipo === 'fim') {
    return formatBRLCompact(b.value)
  }
  return formatBRLCompact(b.delta, true)
}

function formatBRLCompact(v: number, withSign = false): string {
  const abs = Math.abs(v)
  const sign = withSign && v > 0 ? '+' : v < 0 ? '-' : ''
  if (abs >= 1_000_000) {
    return `${sign}R$ ${(abs / 1_000_000).toLocaleString('pt-BR', {
      maximumFractionDigits: 1,
    })}M`
  }
  if (abs >= 1_000) {
    return `${sign}R$ ${(abs / 1_000).toLocaleString('pt-BR', {
      maximumFractionDigits: 1,
    })}k`
  }
  return `${sign}R$ ${abs.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
}

function formatBRL(v: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  }).format(v)
}

function truncar(s: string, max = 14): string {
  if (s.length <= max) return s
  return s.slice(0, max - 1) + '…'
}

// ─────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────

export function WaterfallChartSvg({
  bars,
  width = 900,
  height = 440,
  onBarClick,
}: Props) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  // Helper: true se a barra é clicável (driver com categoryId, NÃO outros)
  const isClickable = (b: WaterfallBar): boolean =>
    Boolean(onBarClick && b.categoryId && !b.isOutros)

  if (bars.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
        Sem dados pra exibir.
      </div>
    )
  }

  const margin = { top: 40, right: 24, bottom: 70, left: 24 }
  const innerW = width - margin.left - margin.right
  const innerH = height - margin.top - margin.bottom

  // Escala adaptativa: usa MIN/MAX dos cumulativos das barras.
  // CHAVE: NÃO força incluir zero — domain é a janela útil real.
  const allYs = bars.flatMap((b) => [b.base, b.end])
  const minY = Math.min(...allYs)
  const maxY = Math.max(...allYs)
  const range = Math.max(maxY - minY, 1) // evita divisão por zero
  const padTop = range * 0.12
  const padBot = range * 0.05
  const yScale = scaleLinear(
    minY - padBot,
    maxY + padTop,
    innerH, // 0 = top, innerH = bottom (Y do SVG cresce pra baixo)
    0,
  )
  const xScale = scaleBand(bars.length, 0, innerW, 0.35)

  const topDriverIdx = findTopDriverIndex(bars)

  return (
    <div className="relative" data-testid="waterfall-chart-svg">
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className="overflow-visible"
      >
        <g transform={`translate(${margin.left},${margin.top})`}>
          {/* Connectors diagonais — desenhar ANTES das barras pra ficarem atrás */}
          {bars.slice(0, -1).map((b, i) => {
            const next = bars[i + 1]
            const slotCur = xScale(i)
            const slotNext = xScale(i + 1)

            // Topo da barra atual = yScale(b.end)
            const yTopoAtual = yScale(b.end)
            // Início da próxima barra:
            //  - 'aumento': começa em next.base
            //  - 'reducao': começa em next.end (que é o cumulative ANTES da redução)
            //  - 'inicio'/'fim': topo absoluto = next.value
            let yInicioProxima: number
            if (next.tipo === 'inicio' || next.tipo === 'fim') {
              yInicioProxima = yScale(next.value)
            } else if (next.tipo === 'aumento') {
              yInicioProxima = yScale(next.base)
            } else {
              // reducao: topo = next.end (cumulative antes de descer)
              yInicioProxima = yScale(next.end)
            }

            return (
              <line
                key={`c${i}`}
                x1={slotCur.x + slotCur.width}
                y1={yTopoAtual}
                x2={slotNext.x}
                y2={yInicioProxima}
                stroke="#cbd5e1"
                strokeWidth={1.2}
                strokeDasharray="4 3"
                opacity={0.75}
              />
            )
          })}

          {/* Barras + labels */}
          {bars.map((b, i) => {
            const slot = xScale(i)
            const yTop = yScale(b.end)
            const yBot = yScale(b.base)
            const yMin = Math.min(yTop, yBot)
            const h = Math.abs(yBot - yTop)
            const cor = corDaBarra(b, i === topDriverIdx)
            const isHovered = hoveredIdx === i
            const isInicioFim = b.tipo === 'inicio' || b.tipo === 'fim'

            // Label position:
            // - Default: acima da barra (yMin - 8)
            // - Se barra muito pequena (< 24px): ainda acima
            // - Aumento: yTop é o topo da barra (Y menor)
            // - Reducao: yBot é o topo (Y menor)
            const labelY = yMin - 8

            const clickable = isClickable(b)
            return (
              <g
                key={i}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                onClick={
                  clickable && onBarClick ? () => onBarClick(b) : undefined
                }
                style={{ cursor: clickable ? 'pointer' : 'default' }}
                data-testid={`waterfall-bar-${i}`}
                data-clickable={clickable}
              >
                {/* Retângulo */}
                <rect
                  x={slot.x}
                  y={yMin}
                  width={slot.width}
                  height={Math.max(h, 2)}
                  fill={cor}
                  rx={2}
                  opacity={isHovered && clickable ? 0.85 : 1}
                />

                {/* Data label */}
                <text
                  x={slot.center}
                  y={labelY}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={i === topDriverIdx || isInicioFim ? 700 : 600}
                  fill={cor}
                  className="select-none"
                >
                  {formatLabel(b)}
                </text>

                {/* Label categoria (eixo X) — abaixo da barra */}
                <text
                  x={slot.center}
                  y={innerH + 16}
                  textAnchor="middle"
                  fontSize={11}
                  fill="#475569"
                  className="select-none"
                >
                  {truncar(b.label, 14)}
                </text>
              </g>
            )
          })}
        </g>
      </svg>

      {/* Tooltip simples no hover */}
      {hoveredIdx !== null && bars[hoveredIdx] && (
        <div
          className="pointer-events-none absolute top-2 right-2 rounded-md bg-slate-900/95 text-white px-3 py-2 text-xs shadow-lg max-w-[280px]"
          role="tooltip"
        >
          <div className="font-semibold mb-1">{bars[hoveredIdx].label}</div>
          <div className="font-mono">
            {bars[hoveredIdx].tipo === 'inicio' ||
            bars[hoveredIdx].tipo === 'fim'
              ? formatBRL(bars[hoveredIdx].value)
              : `${bars[hoveredIdx].delta >= 0 ? '+' : ''}${formatBRL(bars[hoveredIdx].delta)}`}
          </div>
        </div>
      )}
    </div>
  )
}
