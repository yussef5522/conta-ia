import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { transacaoSchema } from '@/lib/validations/transacao'
import { getAuthContext } from '@/lib/auth/rbac'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api/handle-error'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const contaId = searchParams.get('contaId')
    const empresaId = searchParams.get('empresaId')
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50')))
    const inicio = searchParams.get('inicio')
    const fim = searchParams.get('fim')
    const tipo = searchParams.get('tipo')
    const status = searchParams.get('status')
    const semCategoria = searchParams.get('semCategoria') === 'true'

    // Resolve companyId pra ter contexto RBAC.
    // Precedência: contaId → empresaId → "global" (todas as empresas do user, sem permissão única).
    let companyId: string | undefined
    let contaSingle: { id: string; balance: number; name: string; bankName: string | null; accountType: string } | null = null

    if (contaId) {
      const conta = await prisma.bankAccount.findUnique({
        where: { id: contaId },
        select: { id: true, companyId: true, balance: true, name: true, bankName: true, accountType: true },
      })
      if (!conta) return NextResponse.json({ erro: 'Conta não encontrada' }, { status: 404 })
      companyId = conta.companyId
      contaSingle = { id: conta.id, balance: conta.balance, name: conta.name, bankName: conta.bankName, accountType: conta.accountType }
    } else if (empresaId) {
      companyId = empresaId
    }

    let contaWhere: Record<string, unknown>

    if (companyId) {
      // Path com empresa identificada → RBAC normal por empresa
      const ctx = await getAuthContext(request, companyId)
      ctx.requirePermission('transaction.view')

      if (contaId) {
        contaWhere = { bankAccountId: contaId }
      } else {
        contaWhere = { bankAccount: { companyId } }
      }
    } else {
      // Path "global": agrega contas de TODAS empresas do user com permissão view.
      // Sem companyId pra checar permission, então iteramos pelas UCRs do user.
      const ctx = await getAuthContext(request)
      const ucrs = await prisma.userCompanyRole.findMany({
        where: { userId: ctx.user.id },
        include: {
          role: { include: { permissions: { include: { permission: true } } } },
        },
      })
      const empresasComPermView = ucrs
        .filter((u) => u.role.permissions.some((rp) => rp.permission.key === 'transaction.view' || rp.permission.key === 'transaction.*' || rp.permission.key === '*' || rp.permission.key === '*.view'))
        .map((u) => u.companyId)

      const userContas = await prisma.bankAccount.findMany({
        where: { companyId: { in: empresasComPermView } },
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
    if (semCategoria) where.categoryId = null

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
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = transacaoSchema.parse(body)

    // Deriva companyId da conta antes de validar permissions
    const conta = await prisma.bankAccount.findUnique({
      where: { id: data.bankAccountId },
      select: { id: true, companyId: true },
    })
    if (!conta) return NextResponse.json({ erro: 'Conta não encontrada' }, { status: 404 })

    const ctx = await getAuthContext(request, conta.companyId)
    ctx.requirePermission('transaction.create')

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

    await logAudit(ctx, {
      action: 'CREATE',
      entityType: 'Transaction',
      entityId: transacao.id,
      metadata: {
        description: transacao.description,
        amount: transacao.amount,
        type: transacao.type,
        bankAccountId: transacao.bankAccountId,
        categoryId: transacao.categoryId,
      },
      request,
    })

    return NextResponse.json({ transacao }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
