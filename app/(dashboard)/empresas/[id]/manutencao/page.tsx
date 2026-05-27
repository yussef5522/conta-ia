// Sprint 5.0.2.v — Página de manutenção (ações admin isoladas).
//
// Move pra fora do /pendentes os botões de operação esporádica que poluíam
// o header (Reverter transferências, Limpar cache envenenado).

import { redirect, notFound } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { ManutencaoClient } from './manutencao-client'

interface Params {
  params: Promise<{ id: string }>
}

export const dynamic = 'force-dynamic'

export default async function ManutencaoPage({ params }: Params) {
  const { id: empresaId } = await params

  const { cookies } = await import('next/headers')
  const token = (await cookies()).get('token')?.value
  if (!token) redirect('/login')

  let user: { sub: string } | null = null
  try {
    user = await verifyToken(token)
  } catch {
    redirect('/login')
  }
  if (!user) redirect('/login')

  const empresa = await prisma.company.findFirst({
    where: { id: empresaId, users: { some: { userId: user.sub } } },
    select: { id: true, name: true },
  })
  if (!empresa) notFound()

  return (
    <div className="space-y-6">
      <Header
        title="Manutenção"
        description={`${empresa.name} · operações esporádicas de cleanup`}
      />
      <ManutencaoClient empresaId={empresaId} />
    </div>
  )
}
