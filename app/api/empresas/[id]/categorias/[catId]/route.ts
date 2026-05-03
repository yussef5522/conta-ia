import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { categoriaUpdateSchema } from '@/lib/validations/categoria'
import { regimesToJson } from '@/lib/categories/regimes'

interface Params {
  params: Promise<{ id: string; catId: string }>
}

async function verificarAcessoCategoria(userId: string, empresaId: string, categoriaId: string) {
  return prisma.category.findFirst({
    where: {
      id: categoriaId,
      companyId: empresaId,
      company: { users: { some: { userId } } },
    },
  })
}

// GET /api/empresas/[id]/categorias/[catId]
// Retorna a categoria + estatísticas (transactionCount, totalAmount12m, lastUsedAt).
export async function GET(request: NextRequest, { params }: Params) {
  const { id: empresaId, catId } = await params
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  try {
    const categoria = await verificarAcessoCategoria(user.sub, empresaId, catId)
    if (!categoria) {
      return NextResponse.json({ erro: 'Categoria não encontrada' }, { status: 404 })
    }

    const doceMesesAtras = new Date()
    doceMesesAtras.setMonth(doceMesesAtras.getMonth() - 12)

    const [count, sum, lastTx] = await Promise.all([
      prisma.transaction.count({ where: { categoryId: catId } }),
      prisma.transaction.aggregate({
        where: { categoryId: catId, date: { gte: doceMesesAtras } },
        _sum: { amount: true },
      }),
      prisma.transaction.findFirst({
        where: { categoryId: catId },
        orderBy: { date: 'desc' },
        select: { date: true },
      }),
    ])

    return NextResponse.json({
      categoria,
      estatisticas: {
        transactionCount: count,
        totalAmount12m: sum._sum.amount ?? 0,
        lastUsedAt: lastTx?.date ?? null,
      },
    })
  } catch (error) {
    console.error('[CATEGORIAS GET single] Erro:', error)
    return NextResponse.json({ erro: 'Erro ao buscar categoria' }, { status: 500 })
  }
}

// PUT /api/empresas/[id]/categorias/[catId]
// Atualiza categoria. Categorias isSystemDefault=true podem editar nome,
// descrição, cor, ícone, ordem; mas NÃO type ou dreGroup (decisão estratégica
// CONTA-IA-NORTE: type/dreGroup definem o DRE — não pode mudar pra
// preservar consistência dos relatórios).
export async function PUT(request: NextRequest, { params }: Params) {
  const { id: empresaId, catId } = await params
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  try {
    const atual = await verificarAcessoCategoria(user.sub, empresaId, catId)
    if (!atual) {
      return NextResponse.json({ erro: 'Categoria não encontrada' }, { status: 404 })
    }

    const body = await request.json()
    const data = categoriaUpdateSchema.parse(body)

    // Bloqueio: isSystemDefault não pode mudar type/dreGroup
    if (atual.isSystemDefault) {
      if (data.type && data.type !== atual.type) {
        return NextResponse.json(
          { erro: 'Não é possível alterar o tipo de uma categoria padrão do sistema' },
          { status: 400 },
        )
      }
      if (data.dreGroup !== undefined && data.dreGroup !== atual.dreGroup) {
        return NextResponse.json(
          { erro: 'Não é possível alterar o DRE Group de uma categoria padrão do sistema' },
          { status: 400 },
        )
      }
    }

    // Validação parentId (se mudou): deve ser empresa atual + sem ciclo
    if (data.parentId !== undefined && data.parentId !== atual.parentId) {
      if (data.parentId) {
        if (data.parentId === catId) {
          return NextResponse.json({ erro: 'Categoria não pode ser pai dela mesma' }, { status: 400 })
        }
        const novo = await prisma.category.findFirst({
          where: { id: data.parentId, companyId: empresaId },
          select: { id: true },
        })
        if (!novo) {
          return NextResponse.json({ erro: 'Categoria pai inválida' }, { status: 400 })
        }
        // Detecta ciclo: percorre ancestrais e verifica se catId aparece
        let cursorId: string | null = data.parentId
        const visitados = new Set<string>()
        while (cursorId) {
          if (visitados.has(cursorId)) break
          if (cursorId === catId) {
            return NextResponse.json(
              { erro: 'Movimentação criaria ciclo na hierarquia' },
              { status: 400 },
            )
          }
          visitados.add(cursorId)
          const node: { parentId: string | null } | null = await prisma.category.findUnique({
            where: { id: cursorId },
            select: { parentId: true },
          })
          cursorId = node?.parentId ?? null
        }
      }
    }

    const updateData: Record<string, unknown> = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.type !== undefined && !atual.isSystemDefault) updateData.type = data.type
    if (data.dreGroup !== undefined && !atual.isSystemDefault) updateData.dreGroup = data.dreGroup
    if (data.parentId !== undefined) updateData.parentId = data.parentId ?? null
    if (data.code !== undefined) updateData.code = data.code ?? null
    if (data.description !== undefined) updateData.description = data.description ?? null
    if (data.color !== undefined) updateData.color = data.color
    if (data.icon !== undefined) updateData.icon = data.icon ?? null
    if (data.order !== undefined) updateData.order = data.order
    if (data.visibleInRegimes !== undefined) {
      updateData.visibleInRegimes = regimesToJson(data.visibleInRegimes ?? null)
    }
    if (data.isActive !== undefined) updateData.isActive = data.isActive

    const categoria = await prisma.category.update({
      where: { id: catId },
      data: updateData,
    })

    return NextResponse.json({ categoria })
  } catch (error) {
    if (error instanceof ZodError) {
      const campos: Record<string, string> = {}
      error.errors.forEach((e) => {
        if (e.path[0]) campos[e.path[0] as string] = e.message
      })
      return NextResponse.json({ erro: 'Dados inválidos', campos }, { status: 400 })
    }
    console.error('[CATEGORIAS PUT] Erro:', error)
    return NextResponse.json({ erro: 'Erro ao atualizar categoria' }, { status: 500 })
  }
}

// DELETE /api/empresas/[id]/categorias/[catId]
// Soft delete (isActive=false). NÃO faz hard delete pra preservar transações
// vinculadas. Categorias isSystemDefault podem ser desativadas mas nunca
// hard-deletadas (decisão estratégica).
export async function DELETE(request: NextRequest, { params }: Params) {
  const { id: empresaId, catId } = await params
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  try {
    const atual = await verificarAcessoCategoria(user.sub, empresaId, catId)
    if (!atual) {
      return NextResponse.json({ erro: 'Categoria não encontrada' }, { status: 404 })
    }

    await prisma.category.update({
      where: { id: catId },
      data: { isActive: false },
    })

    return NextResponse.json({ mensagem: 'Categoria desativada com sucesso' })
  } catch (error) {
    console.error('[CATEGORIAS DELETE] Erro:', error)
    return NextResponse.json({ erro: 'Erro ao desativar categoria' }, { status: 500 })
  }
}
