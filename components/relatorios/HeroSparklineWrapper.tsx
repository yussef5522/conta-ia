'use client'

// Sprint 5.0.4.0b — Wrapper Client que faz dynamic import com ssr:false.
// Padrão idiomático Next 16 (Sprint 1 Dia 2 documentou: ssr:false não pode
// ser usado em Server Component direto).

import dynamic from 'next/dynamic'

export const HeroSparklineDynamic = dynamic(
  () => import('./HeroSparkline').then((m) => m.HeroSparkline),
  { ssr: false, loading: () => <div style={{ height: 80 }} /> },
)
