import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { categoriaCreateSchema } from '@/lib/validations/categoria'
import { regimesToJson } from '@/lib/categories/regimes'

interface Params {
  params: Promise<{ id: string }>
}

// Verifica que o usuário pertence à empresa (multi-tenant safety).
async function verificarAcesso(userId: string, empresaId: string) {
  return prisma.userCompany.findFirst({
    where: { userId, companyId: empresaId },
  })
}

// GET /api/empresas/[id]/categorias
// Retorna lista flat de TODAS as categorias da empresa (incluindo inativas).
// UI faz a montagem da árvore via parentId.
//
// Query opcional ?soAtivas=true filtra apenas isActive=true.
export async function GET(request: NextRequest, { params }: Params) {
  const { id: empresaId } = await params
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  try {
    const acesso = await verificarAcesso(user.sub, empresaId)
    if (!acesso) return NextResponse.json({ erro: 'Empresa não encontrada' }, { status: 404 })

    const soAtivas = request.nextUrl.searchParams.get('soAtivas') === 'true'

    const categorias = await prisma.category.findMany({
      where: { companyId: empresaId, ...(soAtivas ? { isActive: true } : {}) },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        type: true,
        parentId: true,
        dreGroup: true,
        code: true,
        description: true,
        color: true,
        icon: true,
        order: true,
        visibleInRegimes: true,
        isActive: true,
        isSystemDefault: true,
        _count: { select: { transactions: true } },
      },
    })

    return NextResponse.json({ categorias })
  } catch (error) {
    console.error('[CATEGORIAS GET] Erro:', error)
    return NextResponse.json({ erro: 'Erro ao buscar categorias' }, { status: 500 })
  }
}

// POST /api/empresas/[id]/categorias
// Cria nova categoria (custom, isSystemDefault=false).
export async function POST(request: NextRequest, { params }: Params) {
  const { id: empresaId } = await params
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  try {
    const acesso = await verificarAcesso(user.sub, empresaId)
    if (!acesso) return NextResponse.json({ erro: 'Empresa não encontrada' }, { status: 404 })

    const body = await request.json()
    const data = categoriaCreateSchema.parse(body)

    // Validação extra: parentId (se fornecido) deve pertencer à mesma empresa
    if (data.parentId) {
      const parent = await prisma.category.findFirst({
        where: { id: data.parentId, companyId: empresaId },
        select: { id: true },
      })
      if (!parent) {
        return NextResponse.json({ erro: 'Categoria pai inválida' }, { status: 400 })
      }
    }

    // order default = max(order) + 1 dentro do mesmo parent
    let order = data.order
    if (order === undefined) {
      const maxOrder = await prisma.category.aggregate({
        where: { companyId: empresaId, parentId: data.parentId ?? null },
        _max: { order: true },
      })
      order = (maxOrder._max.order ?? 0) + 1
    }

    const categoria = await prisma.category.create({
      data: {
        companyId: empresaId,
        name: data.name,
        type: data.type,
        parentId: data.parentId ?? null,
        dreGroup: data.dreGroup ?? null,
        code: data.code ?? null,
        description: data.description ?? null,
        color: data.color ?? '#10b981',
        icon: data.icon ?? null,
        order,
        visibleInRegimes: regimesToJson(data.visibleInRegimes ?? null),
        isActive: true,
        isSystemDefault: false,
      },
    })

    return NextResponse.json({ categoria }, { status: 201 })
  } catch (error) {
    if (error instanceof ZodError) {
      const campos: Record<string, string> = {}
      error.errors.forEach((e) => {
        if (e.path[0]) campos[e.path[0] as string] = e.message
      })
      return NextResponse.json({ erro: 'Dados inválidos', campos }, { status: 400 })
    }
    console.error('[CATEGORIAS POST] Erro:', error)
    return NextResponse.json({ erro: 'Erro ao criar categoria' }, { status: 500 })
  }
}
