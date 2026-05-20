// Página /empresas/[id]/regras — Sprint 2.1 Onda 2.
// Server component fino: valida acesso + carrega categorias e empresa.
// Tabela e ações são client-side em regras-client.tsx.

import { notFound, redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import type { Metadata } from 'next'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { RegrasClient } from './regras-client'

interface Props {
  params: Promise<{ id: string }>
}

export const metadata: Metadata = { title: 'Regras Aprendidas' }

export const dynamic = 'force-dynamic'

export default async function RegrasPage({ params }: Props) {
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

  const categorias = await prisma.category.findMany({
    where: { companyId: empresaId, isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, type: true, dreGroup: true, color: true },
  })

  return (
    <RegrasClient
      empresaId={empresaId}
      empresaNome={userCompany.company.tradeName ?? userCompany.company.name}
      categorias={categorias}
    />
  )
}
