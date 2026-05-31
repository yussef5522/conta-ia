// Sprint Landing Page (30/05/2026) — Homepage pública do CAIXAOS.
//
// Detecta sessão via cookie:
//   - LOGADO   → redirect /dashboard (comportamento anterior preservado)
//   - DESLOGADO → renderiza landing pública (Hero + seções comerciais)

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { LandingHeader } from '@/components/landing/header'
import { LandingHero } from '@/components/landing/hero'

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
  },
}

export const dynamic = 'force-dynamic'

export default async function Home() {
  // Se já tem sessão válida, manda direto pro dashboard
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (token) {
    try {
      await verifyToken(token)
      redirect('/dashboard')
    } catch {
      // Token inválido/expirado — segue pra landing
    }
  }

  return (
    <main className="min-h-screen bg-white text-slate-900 antialiased">
      <LandingHeader />
      <LandingHero />
    </main>
  )
}
