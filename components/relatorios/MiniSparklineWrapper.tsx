'use client'

import dynamic from 'next/dynamic'

export const MiniSparklineDynamic = dynamic(
  () => import('./MiniSparkline').then((m) => m.MiniSparkline),
  { ssr: false, loading: () => <div style={{ height: 40 }} /> },
)
