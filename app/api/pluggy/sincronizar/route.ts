import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getAccounts, getTransactions, PLUGGY_ENABLED } from '@/lib/pluggy/client'

// POST /api/pluggy/sincronizar
// Body: { contaId: string } — sincroniza transações da conta via Pluggy
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  if (!PLUGGY_ENABLED) {
    return NextResponse.json({ erro: 'Integração Pluggy não configurada' }, { status: 503 })
  }

  const body = await request.json().catch(() => ({}))
  const { contaId } = body

  if (!contaId) return NextResponse.json({ erro: 'contaId obrigatório' }, { status: 400 })

  const conta = await prisma.bankAccount.findFirst({
    where: { id: contaId, company: { users: { some: { userId: user.sub } } } },
  })
  if (!conta) return NextResponse.json({ erro: 'Conta não encontrada' }, { status: 404 })
  if (!conta.pluggyAccountId) {
    return NextResponse.json({ erro: 'Conta não vinculada ao Pluggy' }, { status: 400 })
  }

  // Busca transações dos últimos 90 dias
  const from = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const transactions = await getTransactions(conta.pluggyAccountId, from)

  if (transactions.length === 0) {
    return NextResponse.json({ mensagem: 'Nenhuma transação nova encontrada.', inseridas: 0 })
  }

  // Deduplica por externalId (ID Pluggy)
  const ids = transactions.map((t) => t.id)
  const existentes = await prisma.transaction.findMany({
    where: { bankAccountId: contaId, externalId: { in: ids } },
    select: { externalId: true },
  })
  const idsExistentes = new Set(existentes.map((e) => e.externalId))
  const novas = transactions.filter((t) => !idsExistentes.has(t.id))

  if (novas.length === 0) {
    return NextResponse.json({ mensagem: 'Todas as transações já estão sincronizadas.', inseridas: 0 })
  }

  const ajusteSaldo = novas.reduce((acc, t) => {
    return acc + (t.type === 'CREDIT' ? t.amount : -t.amount)
  }, 0)

  await prisma.$transaction([
    prisma.transaction.createMany({
      data: novas.map((t) => ({
        bankAccountId: contaId,
        date: new Date(t.date),
        description: t.description,
        amount: Math.abs(t.amount),
        type: t.type,
        status: 'PENDING',
        origin: 'PLUGGY',
        externalId: t.id,
      })),
    }),
    prisma.bankAccount.update({
      where: { id: contaId },
      data: { balance: { increment: ajusteSaldo } },
    }),
  ])

  return NextResponse.json({
    mensagem: `${novas.length} transaç${novas.length !== 1 ? 'ões sincronizadas' : 'ão sincronizada'}.`,
    inseridas: novas.length,
    duplicadas: transactions.length - novas.length,
  })
}
