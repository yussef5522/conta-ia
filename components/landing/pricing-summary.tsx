'use client'

// Sprint Landing v2 Elite (30/05/2026) — Pricing premium com glassmorphism,
// glow no card destacado, animação de toggle suave.

import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Sparkles } from 'lucide-react'
import { PLANOS, DESCONTO_ANUAL, featuresCumulativas, formatPreco } from '@/lib/planos/config'
import type { Plano } from '@/lib/planos/config'
import { SectionReveal } from './section-reveal'
import { fadeUp, EASE_OUT_EXPO } from '@/lib/motion/variants'

type Periodo = 'mensal' | 'anual'

export function LandingPricingSummary() {
  const [periodo, setPeriodo] = useState<Periodo>('mensal')

  return (
    <section id="planos-resumo" className="relative py-28 sm:py-36 overflow-hidden bg-white">
      {/* Decorative top gradient */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-200 to-transparent"
      />

      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionReveal variants={fadeUp}>
          <div className="text-center max-w-3xl mx-auto">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-600">
              Planos
            </p>
            <h2 className="mt-4 text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-[-0.035em] text-slate-900 leading-[1.05] font-display">
              Comece de graça.{' '}
              <span className="italic text-gradient-violet">Escale</span> quando precisar.
            </h2>
            <p className="mt-6 text-lg text-slate-600">
              Sem fidelidade, sem cartão pra testar. Troca de plano em 1 clique.
            </p>
          </div>
        </SectionReveal>

        <BillingToggle value={periodo} onChange={setPeriodo} />

        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-5 items-stretch">
          {PLANOS.map((plano, idx) => (
            <SectionReveal
              key={plano.id}
              variants={{
                hidden: { opacity: 0, y: 24 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.7, delay: idx * 0.1, ease: EASE_OUT_EXPO },
                },
              }}
              className="h-full"
            >
              <PricingCard plano={plano} periodo={periodo} />
            </SectionReveal>
          ))}
        </div>

        <div className="mt-14 text-center">
          <Link
            href="/planos"
            className="group inline-flex items-center gap-1.5 text-sm font-medium text-violet-700 hover:text-violet-900 transition-colors"
          >
            Ver todos os detalhes dos planos
            <span aria-hidden className="transition-transform group-hover:translate-x-1">
              →
            </span>
          </Link>
        </div>
      </div>
    </section>
  )
}

export function BillingToggle({
  value,
  onChange,
}: {
  value: Periodo
  onChange: (v: Periodo) => void
}) {
  return (
    <div className="mt-12 flex items-center justify-center">
      <div className="relative inline-flex items-center rounded-full bg-slate-100 p-1 border border-slate-200/60">
        <motion.div
          layout
          transition={{ duration: 0.4, ease: EASE_OUT_EXPO }}
          className="absolute inset-y-1 rounded-full bg-white shadow-sm border border-slate-200/40"
          style={{
            width: value === 'mensal' ? 80 : 112,
            left: value === 'mensal' ? 4 : 84,
          }}
        />
        <button
          type="button"
          onClick={() => onChange('mensal')}
          className={[
            'relative z-10 w-20 px-4 py-1.5 text-sm font-medium rounded-full transition-colors',
            value === 'mensal' ? 'text-slate-900' : 'text-slate-600 hover:text-slate-900',
          ].join(' ')}
        >
          Mensal
        </button>
        <button
          type="button"
          onClick={() => onChange('anual')}
          className={[
            'relative z-10 w-28 px-4 py-1.5 text-sm font-medium rounded-full transition-colors inline-flex items-center justify-center gap-1.5',
            value === 'anual' ? 'text-slate-900' : 'text-slate-600 hover:text-slate-900',
          ].join(' ')}
        >
          Anual
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">
            −{Math.round(DESCONTO_ANUAL * 100)}%
          </span>
        </button>
      </div>
    </div>
  )
}

export function PricingCard({
  plano,
  periodo,
  mostrarTodasFeatures = false,
}: {
  plano: Plano
  periodo: Periodo
  mostrarTodasFeatures?: boolean
}) {
  const preco = periodo === 'anual' ? plano.precoAnual : plano.precoMensal
  const features = mostrarTodasFeatures
    ? featuresCumulativas(plano.id)
    : plano.featuresIncrementais

  return (
    <div
      className={[
        'relative rounded-3xl flex flex-col h-full transition-all duration-500 group',
        plano.destaque
          ? 'bg-gradient-to-b from-slate-900 to-slate-950 text-white shadow-floating-violet lg:scale-[1.04] z-10 ring-1 ring-violet-500/30'
          : 'bg-white text-slate-900 border border-slate-200/80 shadow-floating hover:-translate-y-1 hover:shadow-floating-violet',
      ].join(' ')}
    >
      {plano.destaque && (
        <>
          {/* Glow externo */}
          <div
            aria-hidden
            className="absolute -inset-px rounded-3xl opacity-80 -z-10"
            style={{
              background:
                'linear-gradient(135deg, rgba(167,139,250,0.6), rgba(124,58,237,0.2), rgba(91,33,182,0.6))',
              filter: 'blur(2px)',
            }}
          />
          {/* Glow ambient */}
          <div
            aria-hidden
            className="absolute -inset-8 -z-20 opacity-60 blur-3xl rounded-full"
            style={{
              background:
                'radial-gradient(50% 50% at 50% 50%, rgba(124,58,237,0.35) 0%, transparent 70%)',
            }}
          />

          <div className="absolute -top-4 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-violet-400 to-violet-600 text-white text-[11px] font-bold uppercase tracking-[0.14em] shadow-lg shadow-violet-900/40 ring-1 ring-violet-300/50">
            <Sparkles size={11} />
            Mais popular
          </div>
        </>
      )}

      <div className="p-7 relative">
        <p
          className={[
            'text-[11px] font-bold uppercase tracking-[0.18em]',
            plano.destaque ? 'text-violet-300' : 'text-slate-500',
          ].join(' ')}
        >
          {plano.nome}
        </p>
        <p
          className={[
            'mt-1 text-sm',
            plano.destaque ? 'text-white/65' : 'text-slate-500',
          ].join(' ')}
        >
          {plano.publico}
        </p>

        <div className="mt-6 flex items-baseline gap-1.5">
          <AnimatePresence mode="wait">
            <motion.span
              key={`${plano.id}-${periodo}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
              className={[
                'text-3xl sm:text-[2.6rem] font-semibold tracking-tight tabular-nums font-display leading-none',
                plano.destaque ? 'text-white' : 'text-slate-900',
              ].join(' ')}
            >
              {formatPreco(preco)}
            </motion.span>
          </AnimatePresence>
          <span
            className={[
              'text-sm',
              plano.destaque ? 'text-white/55' : 'text-slate-500',
            ].join(' ')}
          >
            /mês
          </span>
        </div>
        {periodo === 'anual' && (
          <p
            className={[
              'mt-1 text-xs',
              plano.destaque ? 'text-violet-300' : 'text-emerald-600',
            ].join(' ')}
          >
            Cobrado anual · economize {Math.round(DESCONTO_ANUAL * 100)}%
          </p>
        )}

        <p
          className={[
            'mt-5 text-sm leading-relaxed',
            plano.destaque ? 'text-white/80' : 'text-slate-600',
          ].join(' ')}
        >
          {plano.tagline}
        </p>

        <Link
          href="/cadastro"
          className={[
            'mt-7 inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-3 text-sm font-semibold transition-all active:scale-[0.98] group/btn',
            plano.destaque
              ? 'bg-white text-slate-900 hover:bg-slate-100 shadow-lg shadow-violet-900/20'
              : 'bg-slate-900 text-white hover:bg-slate-800 shadow-md',
          ].join(' ')}
        >
          Teste grátis
          <span
            aria-hidden
            className="transition-transform group-hover/btn:translate-x-1"
          >
            →
          </span>
        </Link>
      </div>

      <div
        className={[
          'border-t flex-1',
          plano.destaque ? 'border-white/10' : 'border-slate-100',
        ].join(' ')}
      >
        <div className="p-7">
          <p
            className={[
              'text-[10px] font-semibold uppercase tracking-[0.18em] mb-4',
              plano.destaque ? 'text-violet-300' : 'text-slate-500',
            ].join(' ')}
          >
            {mostrarTodasFeatures ? 'Tudo que está incluso' : 'O que tem nesse plano'}
          </p>
          <ul className="space-y-3">
            {features.map((f, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span
                  className={[
                    'shrink-0 mt-0.5 h-4 w-4 rounded-full flex items-center justify-center',
                    plano.destaque ? 'bg-violet-500/30' : 'bg-violet-100',
                  ].join(' ')}
                >
                  <Check
                    size={10}
                    strokeWidth={3}
                    className={plano.destaque ? 'text-violet-300' : 'text-violet-700'}
                  />
                </span>
                <span
                  className={[
                    'text-sm leading-snug',
                    plano.destaque ? 'text-white/90' : 'text-slate-700',
                  ].join(' ')}
                >
                  {f}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
