import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { recalcularOrdens } from '@/lib/categories/reorder'

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
  const { id: empresaId } = await params
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  try {
    const body = await request.json()
    const data = reorderSchema.parse(body)

    // Verifica acesso à empresa
    const acesso = await prisma.userCompany.findFirst({
      where: { userId: user.sub, companyId: empresaId },
      select: { id: true },
    })
    if (!acesso) {
      return NextResponse.json({ erro: 'Empresa não encontrada' }, { status: 404 })
    }

    // Categoria existe na empresa?
    const categoria = await prisma.category.findFirst({
      where: { id: data.categoryId, companyId: empresaId },
      select: { id: true, parentId: true },
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

    return NextResponse.json({ success: true, updated: updates.length })
  } catch (error) {
    if (error instanceof z.ZodError) {
      const campos: Record<string, string> = {}
      error.errors.forEach((e) => {
        if (e.path[0]) campos[e.path[0] as string] = e.message
      })
      return NextResponse.json({ erro: 'Dados inválidos', campos }, { status: 400 })
    }
    console.error('[CATEGORIAS REORDER] Erro:', error)
    return NextResponse.json({ erro: 'Erro ao reordenar' }, { status: 500 })
  }
}
