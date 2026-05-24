import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Header } from '@/components/layout/header'
import { TransacaoForm } from '@/components/transacoes/transacao-form'

interface Props { params: Promise<{ id: string; contaId: string; transacaoId: string }> }

export default async function EditarTransacaoPage({ params }: Props) {
  const { id: empresaId, contaId, transacaoId } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) redirect('/login')

  const user = await verifyToken(token)

  const transacao = await prisma.transaction.findFirst({
    where: {
      id: transacaoId,
      bankAccountId: contaId,
      bankAccount: { company: { users: { some: { userId: user.sub } }, id: empresaId } },
    },
    include: { bankAccount: { select: { companyId: true } } },
  })
  if (!transacao || !transacao.bankAccount) notFound()

  const categories = await prisma.category.findMany({
    where: { companyId: transacao.bankAccount.companyId, isActive: true },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, color: true, type: true },
  })

  return (
    <div className="space-y-6">
      <Header title="Editar Lançamento" description={transacao.description} />
      <TransacaoForm
        contaId={contaId}
        empresaId={empresaId}
        categories={categories}
        transacao={{
          id: transacao.id,
          description: transacao.description,
          amount: transacao.amount,
          type: transacao.type,
          date: transacao.date.toISOString(),
          categoryId: transacao.categoryId,
          notes: transacao.notes,
          status: transacao.status,
        }}
      />
    </div>
  )
}
