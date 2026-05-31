// Sprint Landing Page (30/05/2026) — Página /planos detalhada.

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { LandingHeader } from '@/components/landing/header'
import { LandingFooter } from '@/components/landing/footer'
import { LandingCTA } from '@/components/landing/cta-final'
import { PlanosFAQ } from '@/components/landing/planos-faq'
import { PlanosClient } from './planos-client'

export const metadata: Metadata = {
  title: 'Planos e Preços',
  description:
    'Escolha o plano CAIXAOS que cabe no seu negócio. Do MEI à holding multi-empresa. Teste grátis, sem cartão.',
}

export const dynamic = 'force-dynamic'

export default async function PlanosPage() {
  // Logado vai pro dashboard (preserva fluxo do app)
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (token) {
    try {
      await verifyToken(token)
      redirect('/dashboard')
    } catch {
      // Token inválido — segue pra página pública
    }
  }

  return (
    <main className="min-h-screen bg-white text-slate-900 antialiased">
      <LandingHeader />

      <section className="relative pt-28 sm:pt-32 pb-10 sm:pb-12 overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              'radial-gradient(70% 50% at 50% 0%, rgba(237,233,254,0.6) 0%, transparent 60%), #ffffff',
          }}
        />
        <div className="mx-auto max-w-3xl px-5 sm:px-8 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-violet-600">
            Planos
          </p>
          <h1 className="mt-3 text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-[-0.03em] text-slate-900 leading-[1.05]">
            Um plano pra cada{' '}
            <span className="relative inline-block">
              <span className="relative z-10">tamanho de negócio</span>
              <span
                aria-hidden
                className="absolute left-0 bottom-1 h-[10px] w-full -z-0 bg-violet-200/70 rounded-sm"
              />
            </span>
          </h1>
          <p className="mt-5 text-base sm:text-lg text-slate-600">
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
