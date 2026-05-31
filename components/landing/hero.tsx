// Sprint Landing Page (30/05/2026) — Hero principal da landing.
// Vibe editorial minimalista, violeta como acento estratégico, dashboards
// reais à direita como prova de superioridade.

import Link from 'next/link'
import { ArrowRight, Sparkles } from 'lucide-react'
import { HeroVisual } from './hero-visual'

export function LandingHero() {
  return (
    <section className="relative overflow-hidden pt-28 sm:pt-32 pb-16 sm:pb-24">
      {/* Background: noise sutil + grid faded + gradient violet bottom-left */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(80% 60% at 100% 0%, rgba(244,243,255,0.6) 0%, transparent 50%), radial-gradient(60% 50% at 0% 100%, rgba(237,233,254,0.7) 0%, transparent 60%), #ffffff',
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-[0.025]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* === Coluna esquerda: copy === */}
          <div className="lg:col-span-6 max-w-xl">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-violet-200/70 bg-violet-50/60 px-3 py-1 text-[11px] font-medium text-violet-700 backdrop-blur-sm">
              <Sparkles size={12} className="text-violet-600" />
              <span>Novo: IA que entende seu caixa</span>
            </div>

            <h1 className="mt-5 text-[2.5rem] sm:text-5xl lg:text-[3.5rem] leading-[1.05] font-semibold tracking-[-0.03em] text-slate-900">
              Enxergue cada centavo do{' '}
              <span className="relative inline-block">
                <span className="relative z-10">seu negócio</span>
                <span
                  aria-hidden
                  className="absolute left-0 bottom-1 h-[10px] w-full -z-0 bg-violet-200/70 rounded-sm"
                />
              </span>
            </h1>

            <p className="mt-5 text-base sm:text-lg leading-relaxed text-slate-600 max-w-lg">
              Gestão financeira com inteligência de verdade. Importe, analise e
              entenda para onde vai seu dinheiro — em segundos, não em
              planilhas.
            </p>

            <div className="mt-7 flex flex-col sm:flex-row gap-3">
              <Link
                href="/cadastro"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-5 py-3 text-sm font-medium text-white shadow-lg shadow-violet-600/25 transition-all hover:bg-violet-700 hover:shadow-xl hover:shadow-violet-600/30 active:scale-[0.98]"
              >
                Teste grátis
                <ArrowRight size={16} />
              </Link>
              <Link
                href="/planos"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition-all hover:border-slate-400 hover:bg-slate-50"
              >
                Ver planos
              </Link>
            </div>

            <div className="mt-7 flex items-center gap-5 text-xs text-slate-500">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Sem cartão de crédito
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Cancele a hora que quiser
              </div>
            </div>
          </div>

          {/* === Coluna direita: visual === */}
          <div className="lg:col-span-6 relative">
            <HeroVisual />
          </div>
        </div>
      </div>
    </section>
  )
}
