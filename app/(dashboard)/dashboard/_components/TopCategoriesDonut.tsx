'use client'

// Donut chart Recharts — Sprint 1 Dia 2.
// Client component. Importado via dynamic({ssr:false}) pra evitar warning width(-1).

import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import type { TopCategoryItem } from '@/lib/dashboard/compute-top-categories'

interface TopCategoriesDonutProps {
  items: TopCategoryItem[]
  // Tamanho em pixels (largura = altura, donut quadrado).
  size?: number
}

export default function TopCategoriesDonut({ items, size = 120 }: TopCategoriesDonutProps) {
  if (items.length === 0) {
    return <div style={{ width: size, height: size }} />
  }

  return (
    <div style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={items}
            dataKey="amount"
            nameKey="name"
            innerRadius="60%"
            outerRadius="95%"
            paddingAngle={2}
            stroke="none"
            isAnimationActive={false}
          >
            {items.map((it) => (
              <Cell key={it.categoryId} fill={it.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
