import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { transacaoUpdateSchema } from '@/lib/validations/transacao'

interface Params { params: Promise<{ id: string }> }

async function verificarAcesso(userId: string, transacaoId: string) {
  return prisma.transaction.findFirst({
    where: {
      id: transacaoId,
      bankAccount: { company: { users: { some: { userId } } } },
    },
    include: {
      bankAccount: true,
      category: { select: { id: true, name: true, color: true, type: true } },
    },
  })
}

export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  const transacao = await verificarAcesso(user.sub, id)
  if (!transacao) return NextResponse.json({ erro: 'Transação não encontrada' }, { status: 404 })

  return NextResponse.json({ transacao })
}

export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  const antiga = await verificarAcesso(user.sub, id)
  if (!antiga) return NextResponse.json({ erro: 'Transação não encontrada' }, { status: 404 })

  try {
    const body = await request.json()
    const data = transacaoUpdateSchema.parse(body)

    const ajusteSaldo = calcularAjusteSaldo(antiga, data)

    const transacao = await prisma.$transaction(async (tx) => {
      const updated = await tx.transaction.update({
        where: { id },
        data: {
          ...(data.categoryId !== undefined ? { categoryId: data.categoryId ?? null } : {}),
          ...(data.date !== undefined ? { date: data.date } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.amount !== undefined ? { amount: data.amount } : {}),
          ...(data.type !== undefined ? { type: data.type } : {}),
          ...(data.status !== undefined ? { status: data.status } : {}),
          ...(data.notes !== undefined ? { notes: data.notes ?? null } : {}),
        },
        include: { category: { select: { id: true, name: true, color: true, type: true } } },
      })
      if (ajusteSaldo !== 0) {
        await tx.bankAccount.update({
          where: { id: antiga.bankAccountId },
          data: { balance: { increment: ajusteSaldo } },
        })
      }
      return updated
    })

    return NextResponse.json({ transacao })
  } catch (error) {
    if (error instanceof ZodError) {
      const campos: Record<string, string> = {}
      error.errors.forEach((e) => { if (e.path[0]) campos[e.path[0] as string] = e.message })
      return NextResponse.json({ erro: 'Dados inválidos', campos }, { status: 400 })
    }
    console.error('[TRANSACOES PUT] Erro:', error)
    return NextResponse.json({ erro: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { id } = await params
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  const transacao = await verificarAcesso(user.sub, id)
  if (!transacao) return NextResponse.json({ erro: 'Transação não encontrada' }, { status: 404 })

  // Reverte impacto no saldo
  const reverso = transacao.type === 'CREDIT' ? -transacao.amount : transacao.amount

  await prisma.$transaction([
    prisma.transaction.delete({ where: { id } }),
    prisma.bankAccount.update({
      where: { id: transacao.bankAccountId },
      data: { balance: { increment: reverso } },
    }),
  ])

  return NextResponse.json({ mensagem: 'Transação excluída com sucesso' })
}

function calcularAjusteSaldo(
  antiga: { amount: number; type: string },
  nova: { amount?: number; type?: string }
): number {
  const tipoAntigo = antiga.type
  const tipoNovo = nova.type ?? tipoAntigo
  const valorAntigo = antiga.amount
  const valorNovo = nova.amount ?? valorAntigo

  const impactoAntigo = tipoAntigo === 'CREDIT' ? valorAntigo : -valorAntigo
  const impactoNovo = tipoNovo === 'CREDIT' ? valorNovo : -valorNovo

  return impactoNovo - impactoAntigo
}
