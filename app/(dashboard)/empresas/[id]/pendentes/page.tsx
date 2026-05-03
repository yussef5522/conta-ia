import { notFound, redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import type { Metadata } from 'next'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { PendentesClient } from './pendentes-client'

interface Props {
  params: Promise<{ id: string }>
}

export const metadata: Metadata = { title: 'Pendentes de Classificação' }

export default async function PendentesPage({ params }: Props) {
  const { id: empresaId } = await params

  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) redirect('/login')

  const user = await verifyToken(token)

  // Verifica acesso e carrega empresa + categorias em paralelo
  const userCompany = await prisma.userCompany.findFirst({
    where: { userId: user.sub, companyId: empresaId },
    include: {
      company: { select: { id: true, name: true, tradeName: true, type: true } },
    },
  })
  if (!userCompany) notFound()

  const categorias = await prisma.category.findMany({
    where: { companyId: empresaId, isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, type: true, color: true },
  })

  return (
    <PendentesClient
      empresaId={empresaId}
      empresaNome={userCompany.company.tradeName ?? userCompany.company.name}
      categorias={categorias}
    />
  )
}
