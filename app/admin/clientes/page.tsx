// Sprint Gestão de Conta (31/05/2026) — Lista de clientes no admin.
// Visual dark Linear-like coerente com /admin/cupons.

import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { prisma } from '@/lib/db'
import { getAdminSession, loadGerenciador } from '@/lib/admin-auth/session'
import { AdminSidebar } from '@/app/admin/components/admin-sidebar'

export const metadata: Metadata = {
  title: 'Clientes · Admin',
  robots: { index: false, follow: false, nocache: true },
}

export const dynamic = 'force-dynamic'

interface SearchParams {
  searchParams: Promise<{ q?: string; page?: string }>
}

const PAGE_SIZE = 50

export default async function AdminClientesPage({ searchParams }: SearchParams) {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')
  const gerenciador = await loadGerenciador(session.gerenciadorId)
  if (!gerenciador || !gerenciador.active) redirect('/admin/login')

  const sp = await searchParams
  const q = (sp.q ?? '').trim()
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  const skip = (page - 1) * PAGE_SIZE

  const where = q
    ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' as const } },
          { email: { contains: q, mode: 'insensitive' as const } },
        ],
      }
    : undefined

  const [total, clientes] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        mustChangePassword: true,
        createdAt: true,
        _count: { select: { companies: true } },
      },
    }),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="flex">
      <AdminSidebar gerenciadorName={gerenciador.name} />

      <main className="flex-1 min-h-screen">
        {/* Header */}
        <header
          className="px-8 py-5"
          style={{ borderBottom: '1px solid #1a1a1a' }}
        >
          <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: '#737373' }}>
            Painel
          </p>
          <h1
            className="text-xl font-medium tracking-tight mt-0.5"
            style={{ color: '#fafafa' }}
          >
            Clientes
          </h1>
        </header>

        {/* Toolbar */}
        <section className="px-8 py-5" style={{ borderBottom: '1px solid #141414' }}>
          <form className="flex items-center gap-3" method="get">
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Buscar nome ou email..."
              className="flex-1 max-w-md px-3 py-2 rounded text-xs font-mono"
              style={{
                background: '#0a0a0a',
                border: '1px solid #1f1f1f',
                color: '#e5e5e5',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              className="px-3 py-2 rounded text-xs font-medium"
              style={{
                background: '#1f1f1f',
                color: '#fafafa',
                border: '1px solid #2a2a2a',
              }}
            >
              Buscar
            </button>
            {q && (
              <Link
                href="/admin/clientes"
                className="px-3 py-2 rounded text-xs"
                style={{ color: '#737373' }}
              >
                Limpar
              </Link>
            )}
            <span className="ml-auto text-[10px] uppercase tracking-wider" style={{ color: '#525252' }}>
              {total} cliente{total === 1 ? '' : 's'}
            </span>
          </form>
        </section>

        {/* Tabela */}
        <section className="px-8 py-6">
          <div
            className="rounded-md overflow-hidden"
            style={{ background: '#0f0f0f', border: '1px solid #1f1f1f' }}
          >
            {clientes.length === 0 ? (
              <div
                className="px-5 py-10 text-center text-xs"
                style={{ color: '#525252' }}
              >
                Nenhum cliente encontrado.
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr>
                    {['Nome', 'Email', 'Empresas', 'Status', 'Cadastrado', ''].map((h) => (
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
                  {clientes.map((c, i) => (
                    <tr
                      key={c.id}
                      style={{
                        borderBottom:
                          i < clientes.length - 1 ? '1px solid #161616' : 'none',
                      }}
                    >
                      <td className="px-5 py-3 text-xs" style={{ color: '#e5e5e5' }}>
                        {c.name}
                      </td>
                      <td
                        className="px-5 py-3 text-xs font-mono"
                        style={{ color: '#a3a3a3' }}
                      >
                        {c.email}
                      </td>
                      <td
                        className="px-5 py-3 text-xs tabular-nums"
                        style={{ color: '#a3a3a3' }}
                      >
                        {c._count.companies}
                      </td>
                      <td className="px-5 py-3 text-xs">
                        {c.mustChangePassword ? (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider"
                            style={{
                              background: 'rgba(251, 191, 36, 0.1)',
                              color: '#fbbf24',
                              border: '1px solid rgba(251, 191, 36, 0.2)',
                            }}
                          >
                            Troca pendente
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider"
                            style={{
                              background: 'rgba(34, 197, 94, 0.08)',
                              color: '#5DCAA5',
                              border: '1px solid rgba(34, 197, 94, 0.15)',
                            }}
                          >
                            Ativo
                          </span>
                        )}
                      </td>
                      <td
                        className="px-5 py-3 text-xs tabular-nums"
                        style={{ color: '#737373' }}
                      >
                        {new Date(c.createdAt).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Link
                          href={`/admin/clientes/${c.id}`}
                          className="text-[10px] uppercase tracking-wider"
                          style={{ color: '#a3a3a3' }}
                        >
                          Gerenciar →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-xs">
              <span style={{ color: '#525252' }}>
                Página {page} de {totalPages}
              </span>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link
                    href={`/admin/clientes?${new URLSearchParams({ q, page: String(page - 1) }).toString()}`}
                    className="px-3 py-1.5 rounded"
                    style={{
                      background: '#1f1f1f',
                      color: '#e5e5e5',
                      border: '1px solid #2a2a2a',
                    }}
                  >
                    ← Anterior
                  </Link>
                )}
                {page < totalPages && (
                  <Link
                    href={`/admin/clientes?${new URLSearchParams({ q, page: String(page + 1) }).toString()}`}
                    className="px-3 py-1.5 rounded"
                    style={{
                      background: '#1f1f1f',
                      color: '#e5e5e5',
                      border: '1px solid #2a2a2a',
                    }}
                  >
                    Próxima →
                  </Link>
                )}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
