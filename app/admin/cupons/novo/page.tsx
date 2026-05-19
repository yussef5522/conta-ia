// Página de criar cupom — Sprint 1.7.

import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getAdminSession, loadGerenciador } from '@/lib/admin-auth/session'
import { AdminSidebar } from '@/app/admin/components/admin-sidebar'
import { NovoCouponForm } from './coupon-form'

export const metadata: Metadata = {
  title: 'Novo cupom · Admin',
  robots: { index: false, follow: false, nocache: true },
}

export const dynamic = 'force-dynamic'

export default async function NovoCupomPage() {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')
  const gerenciador = await loadGerenciador(session.gerenciadorId)
  if (!gerenciador || !gerenciador.active) redirect('/admin/login')

  return (
    <div className="flex">
      <AdminSidebar gerenciadorName={gerenciador.name} />

      <main className="flex-1 min-h-screen">
        <header
          className="px-8 py-5"
          style={{ borderBottom: '1px solid #1a1a1a' }}
        >
          <Link
            href="/admin/cupons"
            className="text-[10px] uppercase tracking-[0.18em]"
            style={{ color: '#737373' }}
          >
            ← Cupons
          </Link>
          <h1
            className="text-xl font-medium tracking-tight mt-1"
            style={{ color: '#fafafa' }}
          >
            Novo cupom
          </h1>
        </header>

        <section className="px-8 py-6">
          <NovoCouponForm />
        </section>
      </main>
    </div>
  )
}
