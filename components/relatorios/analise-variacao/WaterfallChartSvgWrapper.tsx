'use client'

import dynamic from 'next/dynamic'

// SVG puro não tem problema de SSR (vs Recharts) mas mantemos dynamic
// pra consistência com o padrão do projeto (loading skeleton + code split).
export const WaterfallChartSvgDynamic = dynamic(
  () => import('./WaterfallChartSvg').then((m) => m.WaterfallChartSvg),
  { ssr: false, loading: () => <div style={{ height: 440 }} /> },
)
