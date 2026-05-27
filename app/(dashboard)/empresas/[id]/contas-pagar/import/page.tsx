// Sprint 5.0.2.0 — Importador Excel de Contas a Pagar (server component).

import { redirect, notFound } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { prisma } from '@/lib/db'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { ImportExcelClient } from './import-excel-client'

interface Params {
  params: Promise<{ id: string }>
}

export const dynamic = 'force-dynamic'

export default async function ImportExcelPage({ params }: Params) {
  const { id: empresaId } = await params

  const { cookies } = await import('next/headers')
  const token = (await cookies()).get(COOKIE_NAME)?.value
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
    select: { id: true, name: true, setor: true },
  })
  if (!empresa) notFound()

  return (
    <div className="space-y-6">
      <Header
        title="Importar Contas a Pagar (Excel)"
        description={`${empresa.name} · planilha do contador é parseada por IA, sem reformatação`}
      />
      <ImportExcelClient empresaId={empresaId} empresaNome={empresa.name} />
    </div>
  )
}
