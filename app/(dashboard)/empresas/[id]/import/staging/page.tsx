// Sprint 5.0.2.u — Multi-statement staging UI (server component shell).
//
// Carrega contas da empresa e delega pro client component fazer upload
// múltiplo + preview transferências + confirmação.

import { redirect, notFound } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { StagingMultiUploadClient } from './staging-multi-upload-client'

interface Params {
  params: Promise<{ id: string }>
}

export const dynamic = 'force-dynamic'

export default async function StagingPage({ params }: Params) {
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
    select: {
      id: true,
      name: true,
      cnpj: true,
      bankAccounts: {
        where: { isActive: true },
        select: { id: true, name: true, bankName: true },
        orderBy: { name: 'asc' },
      },
    },
  })
  if (!empresa) notFound()

  return (
    <div className="space-y-6">
      <Header
        title="Importar extratos"
        description="Envie os OFX das suas contas juntos. O sistema detecta transferências entre elas antes de classificar."
      />
      <StagingMultiUploadClient
        empresaId={empresaId}
        empresaCnpj={empresa.cnpj}
        contas={empresa.bankAccounts}
      />
    </div>
  )
}
