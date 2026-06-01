// Sprint Gestão de Conta (31/05/2026) — Autoatendimento: minha conta.
// 3 seções: perfil (nome), segurança (senha), zona de perigo (excluir).

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { MinhaContaClient } from './minha-conta-client'

export const metadata: Metadata = {
  title: 'Minha conta',
}

export const dynamic = 'force-dynamic'

export default async function MinhaContaPage() {
  const store = await cookies()
  const token = store.get(COOKIE_NAME)?.value
  if (!token) redirect('/login')

  let payload
  try {
    payload = await verifyToken(token)
  } catch {
    redirect('/login')
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      _count: { select: { companies: true } },
    },
  })
  if (!user) redirect('/login')

  return (
    <div className="mx-auto max-w-3xl px-5 sm:px-8 py-8 sm:py-12">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-600">
          Conta
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
          Minha conta
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Gerencie seus dados pessoais, segurança e cadastro.
        </p>
      </div>

      <MinhaContaClient
        initialName={user.name}
        email={user.email}
        createdAt={user.createdAt.toISOString()}
        empresasCount={user._count.companies}
      />
    </div>
  )
}
