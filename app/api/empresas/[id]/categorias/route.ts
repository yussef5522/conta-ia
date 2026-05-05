import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { categoriaCreateSchema } from '@/lib/validations/categoria'
import { regimesToJson } from '@/lib/categories/regimes'
import { getAuthContext } from '@/lib/auth/rbac'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api/handle-error'

interface Params {
  params: Promise<{ id: string }>
}

// GET /api/empresas/[id]/categorias
// Retorna lista flat de TODAS as categorias da empresa (incluindo inativas).
// UI faz a montagem da árvore via parentId.
//
// Query opcional ?soAtivas=true filtra apenas isActive=true.
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('category.view')

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
    return handleApiError(error)
  }
}

// POST /api/empresas/[id]/categorias
// Cria nova categoria (custom, isSystemDefault=false).
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('category.create')

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

    await logAudit(ctx, {
      action: 'CREATE',
      entityType: 'Category',
      entityId: categoria.id,
      metadata: {
        name: categoria.name,
        type: categoria.type,
        dreGroup: categoria.dreGroup,
        parentId: categoria.parentId,
      },
      request,
    })

    return NextResponse.json({ categoria }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
