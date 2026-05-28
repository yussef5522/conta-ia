'use client'

// Sprint 5.0.4.0b — Sparkline mini (sem eixos, sem tooltip) pros cards
// de preview. Recharts LineChart compacto.

import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts'
import type { SparklinePoint } from '@/lib/relatorios/preview-queries'

interface Props {
  data: SparklinePoint[]
  /** Cor da linha (hex). Default sky-500 */
  color?: string
  height?: number
}

export function MiniSparkline({
  data,
  color = '#0ea5e9',
  height = 40,
}: Props) {
  if (data.length < 2) return null

  return (
    <div style={{ height }} aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <YAxis hide domain={['auto', 'auto']} />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
