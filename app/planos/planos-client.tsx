'use client'

// Sprint Landing Page (30/05/2026) — Grid interativo da página /planos.
// Reusa PricingCard mas em modo `mostrarTodasFeatures` (cumulativo total).

import { useState } from 'react'
import { PLANOS } from '@/lib/planos/config'
import { BillingToggle, PricingCard } from '@/components/landing/pricing-summary'

type Periodo = 'mensal' | 'anual'

export function PlanosClient() {
  const [periodo, setPeriodo] = useState<Periodo>('mensal')

  return (
    <section className="pb-20 sm:pb-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <BillingToggle value={periodo} onChange={setPeriodo} />

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-4 items-stretch">
          {PLANOS.map((plano) => (
            <PricingCard
              key={plano.id}
              plano={plano}
              periodo={periodo}
              mostrarTodasFeatures
            />
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-slate-500">
          Preços em Reais (BRL). Plano anual é cobrado em uma única parcela com
          {' '}{Math.round(0.2 * 100)}% de desconto.
        </p>
      </div>
    </section>
  )
}
