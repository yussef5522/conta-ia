'use client'

// Sprint Dashboard PF — Donut puro (client). Importar via dynamic ssr:false.

import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import type { ExpenseItem } from './pf-top-expenses-types'

interface DonutProps {
  items: ExpenseItem[]
  size?: number
  onHover?: (item: ExpenseItem | null) => void
}

export default function PFTopExpensesDonut({ items, size = 220, onHover }: DonutProps) {
  if (items.length === 0) {
    return <div style={{ width: size, height: size }} />
  }
  return (
    <div style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={items}
            dataKey="total"
            nameKey="name"
            innerRadius="60%"
            outerRadius="92%"
            paddingAngle={2}
            stroke="none"
            isAnimationActive={false}
            onMouseEnter={(d: unknown) => onHover?.(d as ExpenseItem)}
            onMouseLeave={() => onHover?.(null)}
          >
            {items.map((it, i) => (
              <Cell key={it.categoryId ?? `idx-${i}`} fill={it.color ?? '#94a3b8'} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
