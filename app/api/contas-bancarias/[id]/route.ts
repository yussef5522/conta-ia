import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { contaBancariaSchema } from '@/lib/validations/conta-bancaria'

interface Params { params: Promise<{ id: string }> }

async function verificarAcesso(userId: string, contaId: string) {
  const conta = await prisma.bankAccount.findUnique({
    where: { id: contaId },
    include: { company: { include: { users: { where: { userId } } } } },
  })
  if (!conta || conta.company.users.length === 0) return null
  return conta
}

export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  const conta = await verificarAcesso(user.sub, id)
  if (!conta) return NextResponse.json({ erro: 'Conta não encontrada' }, { status: 404 })

  return NextResponse.json({ conta })
}

export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  const acesso = await verificarAcesso(user.sub, id)
  if (!acesso) return NextResponse.json({ erro: 'Conta não encontrada' }, { status: 404 })

  try {
    const body = await request.json()
    const data = contaBancariaSchema.parse(body)

    const conta = await prisma.bankAccount.update({
      where: { id },
      data: { ...data, bankName: data.bankName || null, bankCode: data.bankCode || null, agency: data.agency || null, accountNumber: data.accountNumber || null },
    })

    return NextResponse.json({ conta })
  } catch (error) {
    if (error instanceof ZodError) {
      const campos: Record<string, string> = {}
      error.errors.forEach((e) => { if (e.path[0]) campos[e.path[0] as string] = e.message })
      return NextResponse.json({ erro: 'Dados inválidos', campos }, { status: 400 })
    }
    console.error('[CONTAS PUT] Erro:', error)
    return NextResponse.json({ erro: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { id } = await params
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  const acesso = await verificarAcesso(user.sub, id)
  if (!acesso) return NextResponse.json({ erro: 'Conta não encontrada' }, { status: 404 })

  await prisma.bankAccount.delete({ where: { id } })
  return NextResponse.json({ mensagem: 'Conta excluída com sucesso' })
}
