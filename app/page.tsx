// Sprint Landing Page (30/05/2026) — Homepage pública CAIXAOS.
//
// Sprint Perf P1+P2 (31/05/2026):
//   - REMOVIDO dynamic='force-dynamic': landing pública nunca muda,
//     pode ser pré-renderizada estaticamente (HTML servido do edge/CDN).
//     O middleware proxy.ts já redireciona logado → /dashboard via
//     PUBLIC_PAGES (linha 25-32). Aqui o check de cookie era redundante.
//   - Resultado: TTFB de 566ms → ~50ms (Yussef logado continua sendo
//     redirecionado pelo middleware antes de chegar nesta página).
//
//   - Lazy-load dos blocos abaixo-do-fold via next/dynamic com
//     ssr:true (SEO preservado, zero layout shift). Tira ~120KB
//     gzipped do bundle inicial.

import type { Metadata } from 'next'
import dynamic from 'next/dynamic'
import { LandingHeader } from '@/components/landing/header'
import { LandingHero } from '@/components/landing/hero'

// Above-the-fold: Header + Hero síncronos (carga imediata)
// Abaixo-do-fold: lazy via dynamic, com SSR mantido pra SEO + LCP.
const LandingSocialProof = dynamic(
  () => import('@/components/landing/social-proof').then((m) => m.LandingSocialProof),
)
const LandingFeatures = dynamic(
  () => import('@/components/landing/features').then((m) => m.LandingFeatures),
)
const LandingComparativo = dynamic(
  () => import('@/components/landing/comparativo').then((m) => m.LandingComparativo),
)
const LandingPricingSummary = dynamic(
  () => import('@/components/landing/pricing-summary').then((m) => m.LandingPricingSummary),
)
const LandingCTA = dynamic(
  () => import('@/components/landing/cta-final').then((m) => m.LandingCTA),
)
const LandingFooter = dynamic(
  () => import('@/components/landing/footer').then((m) => m.LandingFooter),
)
const WhatsAppFloat = dynamic(
  () => import('@/components/landing/whatsapp-float').then((m) => m.WhatsAppFloat),
)

export const metadata: Metadata = {
  title: 'CAIXAOS · Enxergue cada centavo do seu negócio',
  description:
    'Gestão financeira com IA pra PMEs brasileiras. Importe extratos, analise variações e entenda pra onde vai seu dinheiro — em segundos.',
  openGraph: {
    title: 'CAIXAOS · Enxergue cada centavo do seu negócio',
    description:
      'Gestão financeira com IA pra PMEs brasileiras. Importe, analise e entenda — em segundos.',
    type: 'website',
    locale: 'pt_BR',
    siteName: 'CAIXAOS',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CAIXAOS · Enxergue cada centavo do seu negócio',
    description: 'Gestão financeira com IA pra PMEs brasileiras.',
  },
}

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-900 antialiased">
      <LandingHeader />
      <LandingHero />
      <LandingSocialProof />
      <LandingFeatures />
      <LandingComparativo />
      <LandingPricingSummary />
      <LandingCTA />
      <LandingFooter />
      <WhatsAppFloat />
    </main>
  )
}
