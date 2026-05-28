'use client'

// Wrapper Client com dynamic ssr:false (padrão Next 16 — Recharts SSR fix).

import dynamic from 'next/dynamic'

export const WaterfallChartDynamic = dynamic(
  () => import('./WaterfallChart').then((m) => m.WaterfallChart),
  { ssr: false, loading: () => <div style={{ height: 380 }} /> },
)
