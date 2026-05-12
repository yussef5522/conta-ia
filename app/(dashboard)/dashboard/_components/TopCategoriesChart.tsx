'use client'

// Wrapper client pra dynamic import do donut Recharts.
// Next 16 não permite `ssr: false` em next/dynamic dentro de Server Components,
// então isolamos o dynamic neste client component intermediário.

import dynamic from 'next/dynamic'
import type { TopCategoryItem } from '@/lib/dashboard/compute-top-categories'

const Donut = dynamic(() => import('./TopCategoriesDonut'), {
  ssr: false,
  loading: () => <div style={{ width: 120, height: 120 }} />,
})

interface TopCategoriesChartProps {
  items: TopCategoryItem[]
  size?: number
}

export function TopCategoriesChart(props: TopCategoriesChartProps) {
  return <Donut {...props} />
}
