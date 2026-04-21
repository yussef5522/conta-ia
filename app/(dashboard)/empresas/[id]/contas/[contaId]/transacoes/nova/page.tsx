import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Header } from '@/components/layout/header'
import { TransacaoForm } from '@/components/transacoes/transacao-form'

interface Props { params: Promise<{ id: string; contaId: string }> }

export default async function NovaTransacaoPage({ params }: Props) {
  const { id: empresaId, contaId } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) redirect('/login')

  const user = await verifyToken(token)

  const conta = await prisma.bankAccount.findFirst({
    where: { id: contaId, company: { users: { some: { userId: user.sub } }, id: empresaId } },
    include: { company: true },
  })
  if (!conta) notFound()

  const categories = await prisma.category.findMany({
    where: { companyId: conta.companyId, isActive: true },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, color: true, type: true },
  })

  return (
    <div className="space-y-6">
      <Header title="Novo Lançamento" description={`Conta: ${conta.name}`} />
      <TransacaoForm contaId={contaId} empresaId={empresaId} categories={categories} />
    </div>
  )
}
