import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Header } from '@/components/layout/header'
import { TransacaoForm } from '@/components/transacoes/transacao-form'
import { podeMoverDeConta, podeExcluirLancamento } from '@/lib/transacoes/mover-de-conta'

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

  /**
   * ⭐⭐⭐ 30/09/2026 — AS CONTAS DA EMPRESA + O VEREDITO DA FRONTEIRA.
   *
   * O formulário deixava trocar tipo, data, valor, categoria e status — **e não a conta**.
   * Errar a conta é rotina (a venda em dinheiro de 17/09 foi lançada na stone em vez do
   * cofre), e a única saída era apagar e lançar de novo.
   *
   * ⚠️ O veredito vem do SERVIDOR, pela MESMA função que a rota usa pra recusar
   * (`podeMoverDeConta`). Se a tela tivesse régua própria, ela habilitaria o campo num caso
   * que o PUT recusa — e o dono clicaria pra levar um "não". *Uma decisão, um lugar.*
   */
  const contas = await prisma.bankAccount.findMany({
    where: { companyId: transacao.bankAccount.companyId, isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, bankName: true, accountType: true },
  })
  const daLinha = {
    origin: transacao.origin,
    reconciledWithId: transacao.reconciledWithId,
    transferGroupId: transacao.transferGroupId,
    type: transacao.type,
    lifecycle: transacao.lifecycle,
  }
  const fronteira = podeMoverDeConta(daLinha)
  // ⭐ o veredito do EXCLUIR vem do servidor pela MESMA função que a rota usa pra recusar
  const doExcluir = podeExcluirLancamento(daLinha)

  return (
    <div className="space-y-6">
      <Header title="Editar Lançamento" description={transacao.description} />
      <TransacaoForm
        contaId={contaId}
        empresaId={empresaId}
        categories={categories}
        contas={contas}
        podeTrocarConta={fronteira.pode}
        motivoContaTravada={fronteira.explicacao}
        podeExcluir={doExcluir.pode}
        motivoExcluirTravado={doExcluir.explicacao}
        transacao={{
          id: transacao.id,
          description: transacao.description,
          amount: transacao.amount,
          type: transacao.type,
          date: transacao.date.toISOString(),
          categoryId: transacao.categoryId,
          notes: transacao.notes,
          status: transacao.status,
          bankAccountId: transacao.bankAccountId!,
        }}
      />
    </div>
  )
}
