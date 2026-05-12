'use client'

// Mini gráfico de linha pra cards KPI — Sprint 1 Dia 1.
// Sem eixos, sem grid, sem tooltips no MVP. Só a linha e um gradient sutil abaixo.

import { Area, AreaChart, ResponsiveContainer } from 'recharts'
import type { SparkPoint } from '@/lib/dashboard/types'

interface SparklineProps {
  data: SparkPoint[]
  // Cor da linha + área. Default segue brand.
  color?: string
  // Altura em pixels (responsivo no width)
  height?: number
}

export function Sparkline({ data, color = '#185FA5', height = 40 }: SparklineProps) {
  if (data.length === 0) {
    return <div style={{ height }} />
  }

  // ID único pro gradient (evita colisão entre múltiplos sparklines na página)
  const gradientId = `spark-${color.replace('#', '')}`

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
