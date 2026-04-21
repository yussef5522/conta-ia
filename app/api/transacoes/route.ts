import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { transacaoSchema } from '@/lib/validations/transacao'

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const contaId = searchParams.get('contaId')
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50')))
  const inicio = searchParams.get('inicio')
  const fim = searchParams.get('fim')
  const tipo = searchParams.get('tipo')
  const status = searchParams.get('status')

  // Monta cláusula de conta(s) com isolamento multi-tenant
  let contaWhere: Record<string, unknown>
  let contaSingle: { id: string; balance: number; name: string; bankName: string | null; accountType: string } | null = null
  if (contaId) {
    contaSingle = await prisma.bankAccount.findFirst({
      where: { id: contaId, company: { users: { some: { userId: user.sub } } } },
      select: { id: true, balance: true, name: true, bankName: true, accountType: true },
    })
    if (!contaSingle) return NextResponse.json({ erro: 'Conta não encontrada' }, { status: 404 })
    contaWhere = { bankAccountId: contaId }
  } else {
    // Sem contaId: retorna de todas as contas do usuário
    const userContas = await prisma.bankAccount.findMany({
      where: { company: { users: { some: { userId: user.sub } } } },
      select: { id: true },
    })
    contaWhere = { bankAccountId: { in: userContas.map((c) => c.id) } }
  }

  const where: Record<string, unknown> = { ...contaWhere }
  if (inicio || fim) {
    where.date = {
      ...(inicio ? { gte: new Date(inicio) } : {}),
      ...(fim ? { lte: new Date(fim + 'T23:59:59.999Z') } : {}),
    }
  }
  if (tipo) where.type = tipo
  if (status) where.status = status

  const [total, transacoes] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        category: { select: { id: true, name: true, color: true, type: true } },
        bankAccount: { select: { id: true, name: true, bankName: true, balance: true, accountType: true, companyId: true, company: { select: { name: true, tradeName: true } } } },
      },
    }),
  ])

  return NextResponse.json({
    transacoes,
    conta: contaSingle,
    paginacao: { total, page, limit, totalPages: Math.ceil(total / limit) },
  })
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  try {
    const body = await request.json()
    const data = transacaoSchema.parse(body)

    // Verifica acesso à conta
    const conta = await prisma.bankAccount.findFirst({
      where: { id: data.bankAccountId, company: { users: { some: { userId: user.sub } } } },
    })
    if (!conta) return NextResponse.json({ erro: 'Conta não encontrada' }, { status: 404 })

    // Se tem categoryId, verifica que a categoria pertence à mesma empresa
    if (data.categoryId) {
      const cat = await prisma.category.findFirst({
        where: { id: data.categoryId, companyId: conta.companyId },
      })
      if (!cat) return NextResponse.json({ erro: 'Categoria inválida' }, { status: 400 })
    }

    // Cria transação e recalcula saldo em uma transaction
    const [transacao] = await prisma.$transaction([
      prisma.transaction.create({
        data: {
          bankAccountId: data.bankAccountId,
          categoryId: data.categoryId ?? null,
          date: data.date,
          description: data.description,
          amount: data.amount,
          type: data.type,
          status: data.status,
          notes: data.notes ?? null,
          origin: 'MANUAL',
        },
        include: { category: { select: { id: true, name: true, color: true, type: true } } },
      }),
      prisma.bankAccount.update({
        where: { id: data.bankAccountId },
        data: {
          balance: {
            increment: data.type === 'CREDIT' ? data.amount : -data.amount,
          },
        },
      }),
    ])

    return NextResponse.json({ transacao }, { status: 201 })
  } catch (error) {
    if (error instanceof ZodError) {
      const campos: Record<string, string> = {}
      error.errors.forEach((e) => { if (e.path[0]) campos[e.path[0] as string] = e.message })
      return NextResponse.json({ erro: 'Dados inválidos', campos }, { status: 400 })
    }
    console.error('[TRANSACOES POST] Erro:', error)
    return NextResponse.json({ erro: 'Erro interno do servidor' }, { status: 500 })
  }
}
