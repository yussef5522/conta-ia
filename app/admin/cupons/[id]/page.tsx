// Detalhe de cupom + tabela de resgates — Sprint 1.7.

import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { getAdminSession, loadGerenciador } from '@/lib/admin-auth/session'
import { AdminSidebar } from '@/app/admin/components/admin-sidebar'
import { CouponStatusBadge } from '../components/coupon-badge'
import { CouponActions } from './coupon-actions'
import {
  couponTypeLabel,
  formatCouponValue,
  formatUsage,
} from '@/lib/coupons/format'

export const metadata: Metadata = {
  title: 'Detalhe cupom · Admin',
  robots: { index: false, follow: false, nocache: true },
}

export const dynamic = 'force-dynamic'

export default async function CupomDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')
  const gerenciador = await loadGerenciador(session.gerenciadorId)
  if (!gerenciador || !gerenciador.active) redirect('/admin/login')

  const { id } = await params

  const coupon = await prisma.coupon.findUnique({
    where: { id },
    include: {
      redemptions: {
        orderBy: { redeemedAt: 'desc' },
        take: 50,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  })

  if (!coupon) notFound()

  return (
    <div className="flex">
      <AdminSidebar gerenciadorName={gerenciador.name} />

      <main className="flex-1 min-h-screen">
        {/* Header */}
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
          <div className="flex items-baseline gap-3 mt-1.5">
            <h1
              className="text-2xl font-medium tracking-tight font-mono"
              style={{ color: '#fafafa' }}
            >
              {coupon.code}
            </h1>
            <CouponStatusBadge status={coupon.status} />
          </div>
          {coupon.description && (
            <p className="text-xs mt-1.5" style={{ color: '#a3a3a3' }}>
              {coupon.description}
            </p>
          )}
        </header>

        {/* Resumo */}
        <section className="px-8 py-6">
          <div
            className="rounded-md grid grid-cols-2 sm:grid-cols-4 gap-px overflow-hidden"
            style={{
              background: '#1a1a1a',
              border: '1px solid #1f1f1f',
            }}
          >
            <Cell
              label="Tipo"
              value={couponTypeLabel(coupon.type)}
            />
            <Cell
              label="Valor"
              value={formatCouponValue(
                coupon.type,
                Number(coupon.value),
                coupon.freeMonths,
              )}
              mono
            />
            <Cell
              label="Uso"
              value={formatUsage(coupon.currentUses, coupon.maxUses)}
              mono
            />
            <Cell
              label="Por usuário"
              value={String(coupon.maxUsesPerUser)}
              mono
            />
            <Cell
              label="Válido de"
              value={new Date(coupon.validFrom).toLocaleDateString('pt-BR')}
              mono
            />
            <Cell
              label="Válido até"
              value={
                coupon.validUntil
                  ? new Date(coupon.validUntil).toLocaleDateString('pt-BR')
                  : 'Sem prazo'
              }
              mono
            />
            <Cell
              label="Criado em"
              value={new Date(coupon.createdAt).toLocaleDateString('pt-BR')}
              mono
            />
            <Cell
              label="Status"
              value={coupon.status}
              mono
            />
          </div>
        </section>

        {/* Actions */}
        <section className="px-8 pb-6">
          <CouponActions couponId={coupon.id} status={coupon.status} />
        </section>

        {/* Resgates */}
        <section className="px-8 pb-10">
          <div
            className="rounded-md overflow-hidden"
            style={{
              background: '#0f0f0f',
              border: '1px solid #1f1f1f',
            }}
          >
            <div
              className="px-5 py-3"
              style={{ borderBottom: '1px solid #1f1f1f' }}
            >
              <h2
                className="text-xs font-medium tracking-tight"
                style={{ color: '#e5e5e5' }}
              >
                Resgates
              </h2>
              <p
                className="text-[10px] uppercase tracking-wider mt-0.5"
                style={{ color: '#525252' }}
              >
                {coupon.redemptions.length} resgate
                {coupon.redemptions.length === 1 ? '' : 's'} (últimos 50)
              </p>
            </div>

            {coupon.redemptions.length === 0 ? (
              <div
                className="px-5 py-12 text-center text-xs"
                style={{ color: '#525252' }}
              >
                Nenhum resgate ainda. Compartilhe o código para começar.
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr>
                    {['Usuário', 'Email', 'Quando', 'Snapshot', 'IP'].map((h) => (
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
                  {coupon.redemptions.map((r, i) => (
                    <tr
                      key={r.id}
                      style={{
                        borderBottom:
                          i < coupon.redemptions.length - 1
                            ? '1px solid #161616'
                            : 'none',
                      }}
                    >
                      <td
                        className="px-5 py-2.5 text-xs"
                        style={{ color: '#e5e5e5' }}
                      >
                        {r.user?.name ?? '—'}
                      </td>
                      <td
                        className="px-5 py-2.5 text-xs font-mono"
                        style={{ color: '#a3a3a3' }}
                      >
                        {r.user?.email ?? '—'}
                      </td>
                      <td
                        className="px-5 py-2.5 text-xs tabular-nums"
                        style={{ color: '#737373' }}
                      >
                        {new Date(r.redeemedAt).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td
                        className="px-5 py-2.5 text-xs font-mono"
                        style={{ color: '#a3a3a3' }}
                      >
                        {r.codeSnapshot} · {r.typeSnapshot} ·{' '}
                        {Number(r.valueSnapshot)}
                      </td>
                      <td
                        className="px-5 py-2.5 text-xs font-mono"
                        style={{ color: '#525252' }}
                      >
                        {r.ipAddress ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

function Cell({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div
      className="px-4 py-3"
      style={{ background: '#0f0f0f' }}
    >
      <p
        className="text-[10px] uppercase tracking-wider"
        style={{ color: '#737373' }}
      >
        {label}
      </p>
      <p
        className={`text-sm mt-0.5 ${mono ? 'font-mono tabular-nums' : ''}`}
        style={{ color: '#fafafa' }}
      >
        {value}
      </p>
    </div>
  )
}
