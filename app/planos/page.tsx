// Sprint Landing v2 Elite (30/05/2026) — Página /planos detalhada.
// Sprint Perf P1+P2 (31/05/2026): estática + lazy abaixo-do-fold.
// Middleware proxy.ts já redireciona logado → /dashboard via PUBLIC_PAGES.

import type { Metadata } from 'next'
import dynamic from 'next/dynamic'
import { LandingHeader } from '@/components/landing/header'
import { MeshBg } from '@/components/landing/mesh-bg'
import { PlanosClient } from './planos-client'

const LandingCTA = dynamic(
  () => import('@/components/landing/cta-final').then((m) => m.LandingCTA),
)
const LandingFooter = dynamic(
  () => import('@/components/landing/footer').then((m) => m.LandingFooter),
)
const PlanosFAQ = dynamic(
  () => import('@/components/landing/planos-faq').then((m) => m.PlanosFAQ),
)

export const metadata: Metadata = {
  title: 'Planos e Preços',
  description:
    'Escolha o plano CAIXAOS que cabe no seu negócio. Do MEI à holding multi-empresa. Teste grátis, sem cartão.',
}

export default function PlanosPage() {
  return (
    <main className="min-h-screen bg-white text-slate-900 antialiased">
      <LandingHeader />

      <section className="relative pt-36 sm:pt-44 pb-12 sm:pb-16 overflow-hidden">
        <MeshBg variant="light" grid noise />

        <div className="relative mx-auto max-w-4xl px-5 sm:px-8 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-600">
            Planos e Preços
          </p>
          <h1 className="mt-5 text-5xl sm:text-6xl lg:text-[5rem] font-bold tracking-[-0.035em] text-slate-900 leading-[1.02] font-display text-balance">
            Um plano pra cada{' '}
            <span className="text-gradient-violet">tamanho</span> de negócio.
          </h1>
          <p className="mt-7 text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Do autônomo ao grupo com várias empresas. Teste 14 dias grátis em
            qualquer plano. Sem cartão, sem fidelidade.
          </p>
        </div>
      </section>

      <PlanosClient />

      <PlanosFAQ />
      <LandingCTA />
      <LandingFooter />
    </main>
  )
}
