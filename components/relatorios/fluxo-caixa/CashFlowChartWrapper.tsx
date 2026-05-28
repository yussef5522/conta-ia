'use client'

import dynamic from 'next/dynamic'

export const CashFlowChartDynamic = dynamic(
  () => import('./CashFlowChart').then((m) => m.CashFlowChart),
  { ssr: false, loading: () => <div style={{ height: 320 }} /> },
)
