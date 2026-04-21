import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Header } from '@/components/layout/header'
import { ContaForm } from '@/components/contas-bancarias/conta-form'

interface Props { params: Promise<{ id: string }> }

export default async function NovaContaPage({ params }: Props) {
  const { id: empresaId } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) redirect('/login')

  const user = await verifyToken(token)
  const acesso = await prisma.userCompany.findFirst({ where: { userId: user.sub, companyId: empresaId } })
  if (!acesso) notFound()

  return (
    <div className="space-y-6">
      <Header title="Nova Conta Bancária" description="Cadastre uma conta para esta empresa" />
      <ContaForm empresaId={empresaId} />
    </div>
  )
}
