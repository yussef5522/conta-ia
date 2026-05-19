// Lista de cupons no painel admin — Sprint 1.7.
// Vibe Linear: tabela mono + filtros sutis no topo + CTA "Novo cupom".

import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { getAdminSession, loadGerenciador } from '@/lib/admin-auth/session'
import { AdminSidebar } from '@/app/admin/components/admin-sidebar'
import { CouponStatusBadge } from './components/coupon-badge'
import { NewCouponButton } from './components/new-coupon-button'
import {
  couponTypeLabel,
  couponTypeColor,
  formatCouponValue,
  formatUsage,
} from '@/lib/coupons/format'

export const metadata: Metadata = {
  title: 'Cupons · Admin',
  robots: { index: false, follow: false, nocache: true },
}

export const dynamic = 'force-dynamic'

interface SearchParams {
  q?: string
  status?: string
  type?: string
}

export default async function AdminCouponsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')

  const gerenciador = await loadGerenciador(session.gerenciadorId)
  if (!gerenciador || !gerenciador.active) redirect('/admin/login')

  const sp = await searchParams
  const q = sp.q?.trim().toUpperCase()
  const statusFilter = sp.status && sp.status !== 'ALL' ? sp.status : undefined
  const typeFilter = sp.type && sp.type !== 'ALL' ? sp.type : undefined

  const where: Record<string, unknown> = {}
  if (q) where.code = { contains: q }
  if (statusFilter) where.status = statusFilter
  if (typeFilter) where.type = typeFilter

  const [total, cupons] = await Promise.all([
    prisma.coupon.count({ where }),
    prisma.coupon.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  ])

  return (
    <div className="flex">
      <AdminSidebar gerenciadorName={gerenciador.name} />

      <main className="flex-1 min-h-screen">
        {/* Header */}
        <header
          className="px-8 py-5 flex items-center justify-between"
          style={{ borderBottom: '1px solid #1a1a1a' }}
        >
          <div>
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
              Cupons
            </h1>
          </div>
          <NewCouponButton />
        </header>

        {/* Filtros */}
        <section className="px-8 pt-5 pb-3">
          <form
            method="get"
            className="flex flex-wrap items-end gap-3"
          >
            <div className="flex flex-col gap-1">
              <label
                className="text-[10px] uppercase tracking-wider"
                style={{ color: '#737373' }}
              >
                Código
              </label>
              <input
                type="text"
                name="q"
                defaultValue={sp.q ?? ''}
                placeholder="ex: FUNDADOR"
                className="text-xs font-mono px-2.5 py-1.5 rounded outline-none"
                style={{
                  background: '#0f0f0f',
                  border: '1px solid #1f1f1f',
                  color: '#e5e5e5',
                  width: '180px',
                }}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label
                className="text-[10px] uppercase tracking-wider"
                style={{ color: '#737373' }}
              >
                Status
              </label>
              <select
                name="status"
                defaultValue={sp.status ?? 'ALL'}
                className="text-xs px-2.5 py-1.5 rounded outline-none"
                style={{
                  background: '#0f0f0f',
                  border: '1px solid #1f1f1f',
                  color: '#e5e5e5',
                  width: '140px',
                }}
              >
                <option value="ALL">Todos</option>
                <option value="ACTIVE">Ativo</option>
                <option value="PAUSED">Pausado</option>
                <option value="EXPIRED">Expirado</option>
                <option value="EXHAUSTED">Exaurido</option>
                <option value="DEACTIVATED">Desativado</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label
                className="text-[10px] uppercase tracking-wider"
                style={{ color: '#737373' }}
              >
                Tipo
              </label>
              <select
                name="type"
                defaultValue={sp.type ?? 'ALL'}
                className="text-xs px-2.5 py-1.5 rounded outline-none"
                style={{
                  background: '#0f0f0f',
                  border: '1px solid #1f1f1f',
                  color: '#e5e5e5',
                  width: '160px',
                }}
              >
                <option value="ALL">Todos</option>
                <option value="PERCENTAGE">Porcentagem</option>
                <option value="FIXED_AMOUNT">Valor fixo</option>
                <option value="FREE_MONTHS">Meses grátis</option>
              </select>
            </div>

            <button
              type="submit"
              className="text-xs px-3 py-1.5 rounded transition-colors"
              style={{
                background: '#171717',
                border: '1px solid #262626',
                color: '#e5e5e5',
              }}
            >
              Filtrar
            </button>
          </form>
        </section>

        {/* Tabela */}
        <section className="px-8 pb-8">
          <div
            className="rounded-md overflow-hidden"
            style={{
              background: '#0f0f0f',
              border: '1px solid #1f1f1f',
            }}
          >
            <div
              className="px-5 py-3 flex items-center justify-between"
              style={{ borderBottom: '1px solid #1f1f1f' }}
            >
              <p
                className="text-[10px] uppercase tracking-wider"
                style={{ color: '#737373' }}
              >
                {total} cupom{total === 1 ? '' : 's'}
              </p>
            </div>

            {cupons.length === 0 ? (
              <div
                className="px-5 py-12 text-center text-xs"
                style={{ color: '#525252' }}
              >
                Nenhum cupom encontrado. Crie o primeiro em{' '}
                <Link
                  href="/admin/cupons/novo"
                  style={{ color: '#a3a3a3', textDecoration: 'underline' }}
                >
                  Novo cupom
                </Link>
                .
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr>
                    {['Código', 'Descrição', 'Tipo', 'Valor', 'Uso', 'Validade', 'Status'].map(
                      (h) => (
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
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {cupons.map((c, i) => {
                    const typeColor = couponTypeColor(c.type)
                    return (
                      <tr
                        key={c.id}
                        style={{
                          borderBottom:
                            i < cupons.length - 1
                              ? '1px solid #161616'
                              : 'none',
                        }}
                      >
                        <td className="px-5 py-3">
                          <Link
                            href={`/admin/cupons/${c.id}`}
                            className="text-xs font-mono font-medium transition-colors"
                            style={{ color: '#fafafa' }}
                          >
                            {c.code}
                          </Link>
                        </td>
                        <td
                          className="px-5 py-3 text-xs"
                          style={{ color: '#a3a3a3' }}
                        >
                          {c.description ?? '—'}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded"
                            style={{
                              background: typeColor.bg,
                              color: typeColor.text,
                            }}
                          >
                            {couponTypeLabel(c.type)}
                          </span>
                        </td>
                        <td
                          className="px-5 py-3 text-xs font-mono tabular-nums"
                          style={{ color: '#e5e5e5' }}
                        >
                          {formatCouponValue(
                            c.type,
                            Number(c.value),
                            c.freeMonths,
                          )}
                        </td>
                        <td
                          className="px-5 py-3 text-xs font-mono tabular-nums"
                          style={{ color: '#a3a3a3' }}
                        >
                          {formatUsage(c.currentUses, c.maxUses)}
                        </td>
                        <td
                          className="px-5 py-3 text-xs"
                          style={{ color: '#737373' }}
                        >
                          {c.validUntil
                            ? new Date(c.validUntil).toLocaleDateString('pt-BR')
                            : 'Sem prazo'}
                        </td>
                        <td className="px-5 py-3">
                          <CouponStatusBadge status={c.status} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
