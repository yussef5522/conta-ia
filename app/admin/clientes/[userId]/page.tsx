// Sprint Gestão de Conta (31/05/2026) — Detalhe do cliente.
// Mostra dados + 3 ações: reset senha, trocar email, excluir.
// Exclusão SÓ pra Gerenciador OWNER.

import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { prisma } from '@/lib/db'
import { getAdminSession, loadGerenciador } from '@/lib/admin-auth/session'
import { AdminSidebar } from '@/app/admin/components/admin-sidebar'
import { ClienteActions } from './components/cliente-actions'

export const metadata: Metadata = {
  title: 'Detalhe cliente · Admin',
  robots: { index: false, follow: false, nocache: true },
}

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ userId: string }>
}

export default async function AdminClienteDetailPage({ params }: Props) {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')
  const gerenciador = await loadGerenciador(session.gerenciadorId)
  if (!gerenciador || !gerenciador.active) redirect('/admin/login')

  const { userId } = await params
  const cliente = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      mustChangePassword: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          companies: true,
          couponRedemptions: true,
          ofxImports: true,
          recurringSchedules: true,
        },
      },
    },
  })
  if (!cliente) notFound()

  return (
    <div className="flex">
      <AdminSidebar gerenciadorName={gerenciador.name} />

      <main className="flex-1 min-h-screen">
        <header
          className="px-8 py-5"
          style={{ borderBottom: '1px solid #1a1a1a' }}
        >
          <Link
            href="/admin/clientes"
            className="text-[10px] uppercase tracking-[0.18em]"
            style={{ color: '#737373' }}
          >
            ← Clientes
          </Link>
          <h1
            className="text-xl font-medium tracking-tight mt-0.5"
            style={{ color: '#fafafa' }}
          >
            {cliente.name}
          </h1>
          <p className="text-xs font-mono mt-0.5" style={{ color: '#a3a3a3' }}>
            {cliente.email}
          </p>
        </header>

        {/* Stats */}
        <section className="px-8 py-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Empresas" value={cliente._count.companies} />
            <Stat label="Cupons" value={cliente._count.couponRedemptions} />
            <Stat label="Imports OFX" value={cliente._count.ofxImports} />
            <Stat
              label="Agendamentos"
              value={cliente._count.recurringSchedules}
            />
          </div>
        </section>

        {/* Metadados */}
        <section className="px-8 pb-6">
          <div
            className="rounded-md overflow-hidden"
            style={{ background: '#0f0f0f', border: '1px solid #1f1f1f' }}
          >
            <Row label="ID" value={<code className="font-mono text-[10px]">{cliente.id}</code>} />
            <Row
              label="Status"
              value={
                cliente.mustChangePassword ? (
                  <span
                    className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24' }}
                  >
                    Troca de senha pendente
                  </span>
                ) : (
                  <span style={{ color: '#5DCAA5' }}>Ativo</span>
                )
              }
            />
            <Row
              label="Cadastrado em"
              value={new Date(cliente.createdAt).toLocaleString('pt-BR')}
            />
            <Row
              label="Última atualização"
              value={new Date(cliente.updatedAt).toLocaleString('pt-BR')}
            />
          </div>
        </section>

        {/* Ações */}
        <section className="px-8 pb-10">
          <ClienteActions
            userId={cliente.id}
            userEmail={cliente.email}
            userName={cliente.name}
            gerenciadorRole={gerenciador.role}
          />
        </section>
      </main>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="rounded-md p-4"
      style={{ background: '#0f0f0f', border: '1px solid #1f1f1f' }}
    >
      <p
        className="text-[10px] uppercase tracking-[0.18em]"
        style={{ color: '#737373' }}
      >
        {label}
      </p>
      <p
        className="text-2xl font-medium tracking-tight tabular-nums mt-1"
        style={{ color: '#fafafa' }}
      >
        {value}
      </p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      className="flex items-center px-5 py-3 text-xs"
      style={{ borderBottom: '1px solid #161616' }}
    >
      <span
        className="w-40 uppercase tracking-wider text-[10px]"
        style={{ color: '#737373' }}
      >
        {label}
      </span>
      <span style={{ color: '#e5e5e5' }}>{value}</span>
    </div>
  )
}
