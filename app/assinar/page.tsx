// Sprint Asaas 3B (31/05/2026) — /assinar (checkout)
// Reaproveita o /assinar do FATIA 1 (placeholder) e vira o checkout
// real (Pix transparente + Cartão hosted).
//
// 🚨 Bloqueio GRANTED: se chegou aqui sem expirar (ou já ACTIVE)
// redireciona pro dashboard. Yussef@contaia não vê esta tela.

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEffectiveStatusByUserId } from '@/lib/subscription/queries'
import { MeshBg } from '@/components/landing/mesh-bg'
import { AssinarClient } from './assinar-client'

export const metadata: Metadata = {
  title: 'Assinar',
  robots: { index: false, follow: false, nocache: true },
}

export const dynamic = 'force-dynamic'

export default async function AssinarPage() {
  const store = await cookies()
  const token = store.get(COOKIE_NAME)?.value
  if (!token) redirect('/login')

  let payload
  try {
    payload = await verifyToken(token)
  } catch {
    redirect('/login')
  }

  // 🚨 GRANTED + ACTIVE não passam por aqui
  const status = await getEffectiveStatusByUserId(payload.sub)
  if (status) {
    if (status.rawStatus === 'GRANTED') redirect('/dashboard')
    if (status.effectiveStatus === 'ACTIVE') redirect('/dashboard')
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, name: true, email: true, cpfCnpj: true },
  })
  if (!user) redirect('/login')

  return (
    <main className="relative min-h-screen bg-slate-950 text-white overflow-hidden">
      <MeshBg variant="hero-immersive" grid noise />
      <div className="relative mx-auto max-w-5xl px-5 py-12 sm:py-16">
        <header className="text-center mb-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-300">
            Assinatura
          </p>
          <h1 className="mt-3 text-4xl sm:text-5xl font-bold tracking-[-0.03em] text-white">
            Continue com o CAIXAOS
          </h1>
          <p className="mt-3 text-base text-slate-300">
            Olá, <strong>{user.name}</strong>. Escolha seu plano + forma de pagamento.
          </p>
        </header>

        <AssinarClient
          userName={user.name}
          userEmail={user.email}
          cpfCnpjExistente={user.cpfCnpj}
        />
      </div>
    </main>
  )
}
