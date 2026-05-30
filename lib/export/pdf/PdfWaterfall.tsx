// Sprint Export CSV+PDF (29/05/2026) — Waterfall nativo pra Análise de Variação.
//
// Replica WaterfallChartSvg.tsx (3 barras: início antigo / drivers /
// fim novo) com <Svg><Rect><Line> nativo do react-pdf.
//
// Limitações conhecidas do react-pdf SVG:
// - Sem `<text-anchor>` por CSS — usar prop `textAnchor`
// - Sem viewBox responsivo perfeito — definimos width/height fixos
// - `<Line strokeDasharray>` funciona com array (não string)

import React from 'react'
import { View, Svg, Rect, Line, Text as SvgText } from '@react-pdf/renderer'
import type { WaterfallBar } from '@/lib/relatorios/analise-variacao'
import { PDF_COLORS } from './styles'

const COLORS = {
  total: '#1e293b',
  aumento: '#dc2626',
  aumentoDestaque: '#991b1b',
  reducao: '#16a34a',
  reducaoDestaque: '#166534',
  outros: '#94a3b8',
  connector: '#cbd5e1',
} as const

interface Props {
  bars: WaterfallBar[]
  /** Width em pt. Default 510 (cabe no A4 - margins 40+40). */
  width?: number
  /** Height em pt. Default 240. */
  height?: number
}

function scaleLinear(d0: number, d1: number, r0: number, r1: number) {
  if (d1 === d0) return () => r0
  const m = (r1 - r0) / (d1 - d0)
  return (x: number) => r0 + m * (x - d0)
}

function scaleBand(n: number, r0: number, r1: number, padding = 0.35) {
  const range = r1 - r0
  const step = range / n
  const bandwidth = step * (1 - padding)
  const offset = (step - bandwidth) / 2
  return (i: number) => {
    const x = r0 + i * step + offset
    return { x, width: bandwidth, center: x + bandwidth / 2 }
  }
}

function findTopDriverIdx(bars: WaterfallBar[]): number {
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

function corBarra(b: WaterfallBar, isTop: boolean): string {
  if (b.tipo === 'inicio' || b.tipo === 'fim') return COLORS.total
  if (b.isOutros) return COLORS.outros
  const aumento = b.tipo === 'aumento'
  if (isTop) return aumento ? COLORS.aumentoDestaque : COLORS.reducaoDestaque
  return aumento ? COLORS.aumento : COLORS.reducao
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

function formatLabel(b: WaterfallBar): string {
  if (b.tipo === 'inicio' || b.tipo === 'fim') return formatBRLCompact(b.value)
  return formatBRLCompact(b.delta, true)
}

function truncar(s: string, max = 14): string {
  if (s.length <= max) return s
  return s.slice(0, max - 1) + '…'
}

export function PdfWaterfall({
  bars,
  width = 510,
  height = 240,
}: Props) {
  if (bars.length === 0) {
    return (
      <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
        <SvgText style={{ fontSize: 9, color: PDF_COLORS.textMuted }}>
          Sem dados pra exibir.
        </SvgText>
      </View>
    )
  }

  const margin = { top: 26, right: 12, bottom: 40, left: 12 }
  const innerW = width - margin.left - margin.right
  const innerH = height - margin.top - margin.bottom

  // Escala adaptativa (NÃO força incluir zero)
  const allYs = bars.flatMap((b) => [b.base, b.end])
  const minY = Math.min(...allYs)
  const maxY = Math.max(...allYs)
  const range = Math.max(maxY - minY, 1)
  const padTop = range * 0.12
  const padBot = range * 0.05
  const yScale = scaleLinear(minY - padBot, maxY + padTop, innerH, 0)
  const xScale = scaleBand(bars.length, 0, innerW, 0.35)
  const topIdx = findTopDriverIdx(bars)

  return (
    <View>
      <Svg width={width} height={height}>
        {/* Grupo transformado pra margin top/left */}
        {/* react-pdf Svg não suporta <G transform=...> bem — desenhar com
            coordenadas já deslocadas por margin */}

        {/* Connectors diagonais (antes das barras pra ficarem atrás) */}
        {bars.slice(0, -1).map((b, i) => {
          const next = bars[i + 1]
          const slotCur = xScale(i)
          const slotNext = xScale(i + 1)
          const yTopAtual = yScale(b.end)
          let yInicioProxima: number
          if (next.tipo === 'inicio' || next.tipo === 'fim') {
            yInicioProxima = yScale(next.value)
          } else if (next.tipo === 'aumento') {
            yInicioProxima = yScale(next.base)
          } else {
            yInicioProxima = yScale(next.end)
          }
          return (
            <Line
              key={`c${i}`}
              x1={margin.left + slotCur.x + slotCur.width}
              y1={margin.top + yTopAtual}
              x2={margin.left + slotNext.x}
              y2={margin.top + yInicioProxima}
              stroke={COLORS.connector}
              strokeWidth={0.8}
              strokeDasharray="3 2"
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
          const cor = corBarra(b, i === topIdx)
          const isTotal = b.tipo === 'inicio' || b.tipo === 'fim'
          return (
            <React.Fragment key={i}>
              <Rect
                x={margin.left + slot.x}
                y={margin.top + yMin}
                width={slot.width}
                height={Math.max(h, 1.5)}
                fill={cor}
                rx={1.5}
              />
              {/* Data label acima da barra */}
              <SvgText
                x={margin.left + slot.center}
                y={margin.top + yMin - 4}
                textAnchor="middle"
                style={{
                  fontSize: 7,
                  fontFamily:
                    i === topIdx || isTotal ? 'Helvetica-Bold' : 'Helvetica',
                  fill: cor,
                }}
              >
                {formatLabel(b)}
              </SvgText>
              {/* Categoria abaixo */}
              <SvgText
                x={margin.left + slot.center}
                y={margin.top + innerH + 10}
                textAnchor="middle"
                style={{
                  fontSize: 7,
                  fontFamily: 'Helvetica',
                  fill: PDF_COLORS.textSecondary,
                }}
              >
                {truncar(b.label, 14)}
              </SvgText>
            </React.Fragment>
          )
        })}
      </Svg>
    </View>
  )
}

