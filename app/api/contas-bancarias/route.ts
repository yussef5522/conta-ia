import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { contaBancariaSchema } from '@/lib/validations/conta-bancaria'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const empresaId = searchParams.get('empresaId')

    // Isolamento multi-tenant: só retorna contas de empresas do usuário logado
    const userCompanies = await prisma.userCompany.findMany({
      where: { userId: user.sub },
      select: { companyId: true },
    })
    const empresasPermitidas = userCompanies.map((uc) => uc.companyId)

    const where = {
      companyId: empresaId
        ? empresasPermitidas.includes(empresaId)
          ? empresaId
          : 'ACESSO_NEGADO'
        : { in: empresasPermitidas },
    }

    const contas = await prisma.bankAccount.findMany({
      where,
      include: { company: { select: { name: true, tradeName: true } } },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ contas })
  } catch (error) {
    console.error('[CONTAS GET] Erro:', error)
    return NextResponse.json({ erro: 'Erro ao buscar contas bancárias' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  try {
    const body = await request.json()
    const { empresaId, ...rest } = body

    if (!empresaId) {
      return NextResponse.json({ erro: 'empresaId é obrigatório' }, { status: 400 })
    }

    // Isolamento: verifica que o usuário é dono da empresa
    const acesso = await prisma.userCompany.findFirst({
      where: { userId: user.sub, companyId: empresaId },
    })
    if (!acesso) {
      return NextResponse.json({ erro: 'Empresa não encontrada' }, { status: 404 })
    }

    const data = contaBancariaSchema.parse(rest)

    const conta = await prisma.bankAccount.create({
      data: { ...data, companyId: empresaId, bankName: data.bankName || null, bankCode: data.bankCode || null, agency: data.agency || null, accountNumber: data.accountNumber || null },
    })

    return NextResponse.json({ conta }, { status: 201 })
  } catch (error) {
    if (error instanceof ZodError) {
      const campos: Record<string, string> = {}
      error.errors.forEach((e) => { if (e.path[0]) campos[e.path[0] as string] = e.message })
      return NextResponse.json({ erro: 'Dados inválidos', campos }, { status: 400 })
    }
    console.error('[CONTAS POST] Erro:', error)
    return NextResponse.json({ erro: 'Erro interno do servidor' }, { status: 500 })
  }
}
