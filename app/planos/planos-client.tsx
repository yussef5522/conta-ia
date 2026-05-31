'use client'

// Sprint Landing v2 Elite (30/05/2026) — Grid interativo da página /planos.
// Reusa PricingCard em modo `mostrarTodasFeatures` (cumulativo total).

import { useState } from 'react'
import { motion } from 'framer-motion'
import { PLANOS } from '@/lib/planos/config'
import { BillingToggle, PricingCard } from '@/components/landing/pricing-summary'
import { EASE_OUT_EXPO } from '@/lib/motion/variants'

type Periodo = 'mensal' | 'anual'

export function PlanosClient() {
  const [periodo, setPeriodo] = useState<Periodo>('mensal')

  return (
    <section className="pb-24 sm:pb-32">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <BillingToggle value={periodo} onChange={setPeriodo} />

        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-5 items-stretch">
          {PLANOS.map((plano, idx) => (
            <motion.div
              key={plano.id}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 + idx * 0.1, ease: EASE_OUT_EXPO }}
              className="h-full"
            >
              <PricingCard plano={plano} periodo={periodo} mostrarTodasFeatures />
            </motion.div>
          ))}
        </div>

        <p className="mt-10 text-center text-xs text-slate-500">
          Preços em Reais (BRL). Plano anual é cobrado em uma única parcela com
          20% de desconto.
        </p>
      </div>
    </section>
  )
}
