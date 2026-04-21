import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Header } from '@/components/layout/header'
import { ContaForm } from '@/components/contas-bancarias/conta-form'

interface Props { params: Promise<{ id: string; contaId: string }> }

export default async function EditarContaPage({ params }: Props) {
  const { id: empresaId, contaId } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) redirect('/login')

  const user = await verifyToken(token)

  const conta = await prisma.bankAccount.findFirst({
    where: { id: contaId, company: { users: { some: { userId: user.sub } }, id: empresaId } },
  })
  if (!conta) notFound()

  return (
    <div className="space-y-6">
      <Header title="Editar Conta" description={conta.name} />
      <ContaForm empresaId={empresaId} conta={conta} />
    </div>
  )
}
