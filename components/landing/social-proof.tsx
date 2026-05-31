'use client'

// Sprint Landing v2 Elite (30/05/2026) — Faixa de "stats" com contador
// animado. Dark band entre Hero e Features pra criar ritmo visual.

import { motion } from 'framer-motion'
import { AnimatedCounter } from './animated-counter'
import { SectionReveal } from './section-reveal'
import { fadeUp, staggerContainer, EASE_OUT_EXPO } from '@/lib/motion/variants'

const STATS = [
  { value: 30, suffix: 's', label: 'Setup', sub: 'do cadastro ao 1º import' },
  { value: 81, suffix: '%', label: 'Auto-classificação', sub: 'média no 1º extrato' },
  { value: 100, suffix: '%', label: 'Bancos BR', sub: 'via OFX/Excel/CSV' },
  { value: 0, prefix: 'R$ ', label: 'Setup fee', sub: 'sem cartão pra testar' },
] as const

export function LandingSocialProof() {
  return (
    <section className="relative overflow-hidden bg-slate-950 text-white border-y border-white/5">
      {/* Mesh decorativo dark */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            'radial-gradient(60% 80% at 50% 50%, rgba(124,58,237,0.18) 0%, transparent 60%)',
        }}
      />
      <div aria-hidden className="absolute inset-0 bg-grid-dark opacity-40" />

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8 py-16 sm:py-20">
        <SectionReveal variants={fadeUp}>
          <div className="text-center max-w-2xl mx-auto mb-12">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-300">
              POR QUE CAIXAOS
            </p>
            <p className="mt-3 text-2xl sm:text-3xl font-semibold text-white/95 leading-snug font-display tracking-tight">
              Detecta despesas que sua planilha esconde.
            </p>
          </div>
        </SectionReveal>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-10"
        >
          {STATS.map((stat) => (
            <motion.div
              key={stat.label}
              variants={{
                hidden: { opacity: 0, y: 16 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE_OUT_EXPO } },
              }}
              className="text-center lg:text-left"
            >
              <div className="text-4xl sm:text-5xl lg:text-[3.5rem] font-semibold text-white tabular-nums tracking-tight font-display leading-none">
                <AnimatedCounter
                  value={stat.value}
                  prefix={'prefix' in stat ? stat.prefix : ''}
                  suffix={'suffix' in stat ? stat.suffix : ''}
                  duration={1.8}
                />
              </div>
              <div className="mt-3 text-sm font-medium text-violet-300 uppercase tracking-wider">
                {stat.label}
              </div>
              <div className="mt-1 text-xs text-white/50">{stat.sub}</div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
