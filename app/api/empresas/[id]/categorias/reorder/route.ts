import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { recalcularOrdens } from '@/lib/categories/reorder'
import { getAuthContext } from '@/lib/auth/rbac'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api/handle-error'

interface Params {
  params: Promise<{ id: string }>
}

const reorderSchema = z.object({
  categoryId: z.string().cuid('ID inválido'),
  newOrder: z.number().int().min(0),
  parentId: z.string().cuid().nullable(),
})

// PATCH /api/empresas/[id]/categorias/reorder
// Reordena uma categoria DENTRO DO MESMO NÍVEL (mesmo parentId).
// NÃO move entre níveis (use PUT /[catId] com novo parentId pra isso).
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('category.reorder')

    const body = await request.json()
    const data = reorderSchema.parse(body)

    // Categoria existe na empresa?
    const categoria = await prisma.category.findFirst({
      where: { id: data.categoryId, companyId: empresaId },
      select: { id: true, parentId: true, name: true },
    })
    if (!categoria) {
      return NextResponse.json({ erro: 'Categoria não encontrada' }, { status: 404 })
    }

    // parentId do body bate com o real? (não permite mover entre níveis)
    if ((categoria.parentId ?? null) !== (data.parentId ?? null)) {
      return NextResponse.json(
        {
          erro:
            "Não é possível mover entre níveis via reorder. Use o campo 'É subcategoria de...' no formulário de edição.",
        },
        { status: 400 },
      )
    }

    // Carrega irmãos (mesmo parentId) e recalcula
    const irmaos = await prisma.category.findMany({
      where: { companyId: empresaId, parentId: data.parentId ?? null },
      select: { id: true, order: true },
    })

    const updates = recalcularOrdens(irmaos, data.categoryId, data.newOrder)

    if (updates.length === 0) {
      // Sem mudanças (categoria já estava na posição alvo)
      return NextResponse.json({ success: true, updated: 0 })
    }

    // Aplica updates em transação
    await prisma.$transaction(
      updates.map((u) =>
        prisma.category.update({
          where: { id: u.id },
          data: { order: u.order },
        }),
      ),
    )

    await logAudit(ctx, {
      action: 'REORDER',
      entityType: 'Category',
      entityId: data.categoryId,
      metadata: {
        name: categoria.name,
        parentId: data.parentId,
        newOrder: data.newOrder,
        affected: updates.length,
      },
      request,
    })

    return NextResponse.json({ success: true, updated: updates.length })
  } catch (error) {
    return handleApiError(error)
  }
}
