import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { empresaSchema } from '@/lib/validations/empresa'

interface Params {
  params: Promise<{ id: string }>
}

async function verificarAcesso(userId: string, empresaId: string) {
  return prisma.userCompany.findFirst({
    where: { userId, companyId: empresaId },
    include: { company: true },
  })
}

export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  const acesso = await verificarAcesso(user.sub, id)
  if (!acesso) return NextResponse.json({ erro: 'Empresa não encontrada' }, { status: 404 })

  return NextResponse.json({ empresa: acesso.company })
}

export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  const acesso = await verificarAcesso(user.sub, id)
  if (!acesso) return NextResponse.json({ erro: 'Empresa não encontrada' }, { status: 404 })

  try {
    const body = await request.json()
    // Em edição, o CNPJ não é alterado — remover do parse
    const { cnpj: _cnpj, ...rest } = body
    const data = empresaSchema.omit({ cnpj: true }).parse(rest)

    const empresa = await prisma.company.update({
      where: { id },
      data: {
        name: data.name,
        tradeName: data.tradeName || null,
        type: data.type,
        taxRegime: data.taxRegime,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        zipCode: data.zipCode || null,
      },
    })

    return NextResponse.json({ empresa })
  } catch (error) {
    if (error instanceof ZodError) {
      const campos: Record<string, string> = {}
      error.errors.forEach((e) => {
        if (e.path[0]) campos[e.path[0] as string] = e.message
      })
      return NextResponse.json({ erro: 'Dados inválidos', campos }, { status: 400 })
    }
    console.error('[EMPRESAS PUT] Erro interno:', error)
    return NextResponse.json({ erro: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { id } = await params
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  const acesso = await verificarAcesso(user.sub, id)
  if (!acesso) return NextResponse.json({ erro: 'Empresa não encontrada' }, { status: 404 })

  await prisma.company.delete({ where: { id } })

  return NextResponse.json({ mensagem: 'Empresa excluída com sucesso' })
}
