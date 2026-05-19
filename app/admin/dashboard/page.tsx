// Dashboard do painel admin — Sprint 1.6.
// 4 KPI cards + tabela últimos 10 cadastros. MRR placeholder (Onda 4).

import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { prisma } from '@/lib/db'
import { getAdminSession, loadGerenciador } from '@/lib/admin-auth/session'
import { AdminSidebar } from '@/app/admin/components/admin-sidebar'
import { StatCard } from '@/app/admin/components/stat-card'

export const metadata: Metadata = {
  title: 'Dashboard Admin',
  robots: { index: false, follow: false, nocache: true },
}

export const dynamic = 'force-dynamic'

export default async function AdminDashboardPage() {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')

  const gerenciador = await loadGerenciador(session.gerenciadorId)
  if (!gerenciador || !gerenciador.active) redirect('/admin/login')

  // Stats em paralelo
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const [totalClientes, totalEmpresas, cadastros7d, ultimosCadastros] =
    await Promise.all([
      prisma.user.count(),
      prisma.company.count(),
      prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
        },
      }),
    ])

  return (
    <div className="flex">
      <AdminSidebar gerenciadorName={gerenciador.name} />

      <main className="flex-1 min-h-screen">
        {/* Header */}
        <header
          className="px-8 py-5"
          style={{ borderBottom: '1px solid #1a1a1a' }}
        >
          <p
            className="text-[10px] uppercase tracking-[0.18em]"
            style={{ color: '#737373' }}
          >
            Painel
          </p>
          <h1
            className="text-xl font-medium tracking-tight mt-0.5"
            style={{ color: '#fafafa' }}
          >
            Dashboard
          </h1>
        </header>

        {/* Stats */}
        <section className="px-8 py-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label="Clientes"
              value={totalClientes}
              hint="Usuários cadastrados"
            />
            <StatCard
              label="Empresas"
              value={totalEmpresas}
              hint="CNPJs ativos"
            />
            <StatCard
              label="MRR"
              value="R$ 0,00"
              hint="Onda 4 — em desenvolvimento"
              accent="#525252"
            />
            <StatCard
              label="Novos (7d)"
              value={cadastros7d}
              hint={
                cadastros7d > 0
                  ? `+${cadastros7d} esta semana`
                  : 'Sem cadastros recentes'
              }
              accent={cadastros7d > 0 ? '#5DCAA5' : '#525252'}
            />
          </div>
        </section>

        {/* Últimos cadastros */}
        <section className="px-8 pb-8">
          <div
            className="rounded-md overflow-hidden"
            style={{
              background: '#0f0f0f',
              border: '1px solid #1f1f1f',
            }}
          >
            <div
              className="px-5 py-3.5"
              style={{ borderBottom: '1px solid #1f1f1f' }}
            >
              <h2
                className="text-xs font-medium tracking-tight"
                style={{ color: '#e5e5e5' }}
              >
                Últimos cadastros
              </h2>
              <p
                className="text-[10px] uppercase tracking-wider mt-0.5"
                style={{ color: '#525252' }}
              >
                Top 10 usuários mais recentes
              </p>
            </div>

            {ultimosCadastros.length === 0 ? (
              <div
                className="px-5 py-10 text-center text-xs"
                style={{ color: '#525252' }}
              >
                Nenhum cadastro ainda
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr>
                    {['Nome', 'Email', 'Cadastrado'].map((h) => (
                      <th
                        key={h}
                        className="text-left text-[10px] uppercase tracking-wider px-5 py-2.5"
                        style={{
                          color: '#737373',
                          borderBottom: '1px solid #1f1f1f',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ultimosCadastros.map((u, i) => (
                    <tr
                      key={u.id}
                      style={{
                        borderBottom:
                          i < ultimosCadastros.length - 1
                            ? '1px solid #161616'
                            : 'none',
                      }}
                    >
                      <td
                        className="px-5 py-3 text-xs"
                        style={{ color: '#e5e5e5' }}
                      >
                        {u.name}
                      </td>
                      <td
                        className="px-5 py-3 text-xs font-mono"
                        style={{ color: '#a3a3a3' }}
                      >
                        {u.email}
                      </td>
                      <td
                        className="px-5 py-3 text-xs tabular-nums"
                        style={{ color: '#737373' }}
                      >
                        {new Date(u.createdAt).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <p
            className="text-[10px] mt-3"
            style={{ color: '#525252' }}
          >
            TODO Onda 4: integrar com sistema de subscriptions pra MRR/churn real.
          </p>
        </section>
      </main>
    </div>
  )
}
