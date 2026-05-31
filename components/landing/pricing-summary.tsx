'use client'

// Sprint Landing Page (30/05/2026) — Pricing resumido na landing.
// 4 cards com toggle Mensal/Anual. Inteligência destacado.

import { useState } from 'react'
import Link from 'next/link'
import { Check, Sparkles } from 'lucide-react'
import { PLANOS, DESCONTO_ANUAL, featuresCumulativas, formatPreco } from '@/lib/planos/config'
import type { Plano } from '@/lib/planos/config'

type Periodo = 'mensal' | 'anual'

export function LandingPricingSummary() {
  const [periodo, setPeriodo] = useState<Periodo>('mensal')

  return (
    <section id="planos-resumo" className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-violet-600">
            Planos
          </p>
          <h2 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-[-0.02em] text-slate-900 leading-[1.1]">
            Comece de graça. Escale quando precisar.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600">
            Sem fidelidade, sem cartão pra testar. Troca de plano em 1 clique.
          </p>
        </div>

        <BillingToggle value={periodo} onChange={setPeriodo} />

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-4 items-stretch">
          {PLANOS.map((plano) => (
            <PricingCard key={plano.id} plano={plano} periodo={periodo} />
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/planos"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-700 hover:text-violet-900 transition-colors"
          >
            Ver todos os detalhes dos planos
            <span aria-hidden>→</span>
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
    <div className="mt-10 flex items-center justify-center gap-3">
      <div className="inline-flex items-center rounded-full bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => onChange('mensal')}
          className={[
            'px-4 py-1.5 text-sm font-medium rounded-full transition-all',
            value === 'mensal'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900',
          ].join(' ')}
        >
          Mensal
        </button>
        <button
          type="button"
          onClick={() => onChange('anual')}
          className={[
            'px-4 py-1.5 text-sm font-medium rounded-full transition-all inline-flex items-center gap-1.5',
            value === 'anual'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900',
          ].join(' ')}
        >
          Anual
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-700">
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
        'relative rounded-2xl flex flex-col transition-all',
        plano.destaque
          ? 'bg-slate-900 text-white border-2 border-violet-500 shadow-2xl shadow-violet-900/20 lg:scale-[1.03] z-10'
          : 'bg-white text-slate-900 border border-slate-200 shadow-md shadow-slate-900/5',
      ].join(' ')}
    >
      {plano.destaque && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r from-violet-500 to-violet-600 text-white text-[11px] font-semibold uppercase tracking-wider shadow-lg shadow-violet-900/30">
          <Sparkles size={11} />
          Mais popular
        </div>
      )}

      <div className="p-6">
        <p
          className={[
            'text-[11px] font-semibold uppercase tracking-[0.16em]',
            plano.destaque ? 'text-violet-300' : 'text-slate-500',
          ].join(' ')}
        >
          {plano.nome}
        </p>
        <p
          className={[
            'mt-1 text-sm',
            plano.destaque ? 'text-white/70' : 'text-slate-500',
          ].join(' ')}
        >
          {plano.publico}
        </p>

        <div className="mt-5 flex items-baseline gap-1.5">
          <span
            className={[
              'text-3xl sm:text-4xl font-semibold tracking-tight tabular-nums',
              plano.destaque ? 'text-white' : 'text-slate-900',
            ].join(' ')}
          >
            {formatPreco(preco)}
          </span>
          <span
            className={[
              'text-sm',
              plano.destaque ? 'text-white/60' : 'text-slate-500',
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
            'mt-4 text-sm leading-relaxed',
            plano.destaque ? 'text-white/80' : 'text-slate-600',
          ].join(' ')}
        >
          {plano.tagline}
        </p>

        <Link
          href="/cadastro"
          className={[
            'mt-6 inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium transition-all active:scale-[0.98]',
            plano.destaque
              ? 'bg-white text-slate-900 hover:bg-slate-100'
              : 'bg-violet-600 text-white hover:bg-violet-700 shadow-sm shadow-violet-600/20',
          ].join(' ')}
        >
          Teste grátis
        </Link>
      </div>

      <div
        className={[
          'border-t flex-1',
          plano.destaque ? 'border-white/10' : 'border-slate-100',
        ].join(' ')}
      >
        <div className="p-6">
          <p
            className={[
              'text-[10px] font-semibold uppercase tracking-wider mb-3',
              plano.destaque ? 'text-violet-300' : 'text-slate-500',
            ].join(' ')}
          >
            {mostrarTodasFeatures ? 'Tudo que está incluso' : 'O que tem nesse plano'}
          </p>
          <ul className="space-y-2.5">
            {features.map((f, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <Check
                  size={14}
                  strokeWidth={2.5}
                  className={[
                    'shrink-0 mt-0.5',
                    plano.destaque ? 'text-violet-400' : 'text-violet-600',
                  ].join(' ')}
                />
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
