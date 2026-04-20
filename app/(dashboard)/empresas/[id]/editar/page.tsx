import { notFound, redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Header } from '@/components/layout/header'
import { EmpresaForm } from '@/components/empresas/empresa-form'
import { t } from '@/lib/i18n/pt-BR'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ id: string }>
}

export const metadata: Metadata = { title: 'Editar Empresa' }

export default async function EditarEmpresaPage({ params }: Props) {
  const { id } = await params

  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) redirect('/login')

  const user = await verifyToken(token)

  const userCompany = await prisma.userCompany.findFirst({
    where: { companyId: id, userId: user.sub },
    include: { company: true },
  })

  if (!userCompany) notFound()

  const empresa = userCompany.company

  return (
    <div className="space-y-6">
      <Header
        title={t.empresa.form.titleEdit}
        description={empresa.tradeName || empresa.name}
      />
      <EmpresaForm empresa={empresa} />
    </div>
  )
}
