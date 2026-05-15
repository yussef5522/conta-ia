'use client'

// Wrapper client pra dynamic import do waterfall Recharts.
// Next 16 não permite `ssr: false` em next/dynamic dentro de Server Components,
// então isolamos o dynamic neste client component intermediário.
// (mesmo padrão de TopCategoriesChart.tsx)

import dynamic from 'next/dynamic'
import type { WaterfallBar } from '@/lib/dashboard/compute-waterfall'

const Chart = dynamic(() => import('./CashflowWaterfallChart'), {
  ssr: false,
  loading: () => <div style={{ height: 320 }} className="w-full animate-pulse rounded-md bg-muted" />,
})

interface CashflowWaterfallChartLoaderProps {
  bars: WaterfallBar[]
  totalEntradas: number
  totalSaidas: number
  periodStart: string // ISO — pro drill-down
  periodEnd: string // ISO
}

export function CashflowWaterfallChartLoader(props: CashflowWaterfallChartLoaderProps) {
  return <Chart {...props} />
}
