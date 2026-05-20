// Página /empresas/[id]/imports — Sprint 2.3 Onda 2.
// Histórico geral de imports OFX da empresa.

import { notFound, redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import type { Metadata } from 'next'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { ImportsClient } from './imports-client'

interface Props {
  params: Promise<{ id: string }>
}

export const metadata: Metadata = { title: 'Histórico de Imports' }

export const dynamic = 'force-dynamic'

export default async function ImportsPage({ params }: Props) {
  const { id: empresaId } = await params

  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) redirect('/login')

  const user = await verifyToken(token)

  const userCompany = await prisma.userCompany.findFirst({
    where: { userId: user.sub, companyId: empresaId },
    include: {
      company: { select: { id: true, name: true, tradeName: true } },
    },
  })
  if (!userCompany) notFound()

  const contas = await prisma.bankAccount.findMany({
    where: { companyId: empresaId, isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, bankName: true },
  })

  return (
    <ImportsClient
      empresaId={empresaId}
      empresaNome={userCompany.company.tradeName ?? userCompany.company.name}
      contas={contas}
    />
  )
}
