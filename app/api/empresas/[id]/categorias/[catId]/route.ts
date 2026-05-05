import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { categoriaUpdateSchema } from '@/lib/validations/categoria'
import { regimesToJson } from '@/lib/categories/regimes'
import { canHardDelete, getHardDeleteDisabledReason } from '@/lib/categories/delete-rules'
import { getAuthContext } from '@/lib/auth/rbac'
import { logAudit, diffFields } from '@/lib/audit'
import { handleApiError } from '@/lib/api/handle-error'

interface Params {
  params: Promise<{ id: string; catId: string }>
}

// GET /api/empresas/[id]/categorias/[catId]
// Retorna a categoria + estatísticas (transactionCount, totalAmount12m, lastUsedAt).
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId, catId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('category.view')

    const categoria = await prisma.category.findFirst({
      where: { id: catId, companyId: empresaId },
    })
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
    return handleApiError(error)
  }
}

// PUT /api/empresas/[id]/categorias/[catId]
// Atualiza categoria. Categorias isSystemDefault=true podem editar nome,
// descrição, cor, ícone, ordem; mas NÃO type ou dreGroup (decisão estratégica
// CONTA-IA-NORTE: type/dreGroup definem o DRE — não pode mudar pra
// preservar consistência dos relatórios).
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId, catId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('category.update')

    const atual = await prisma.category.findFirst({
      where: { id: catId, companyId: empresaId },
    })
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

    const fieldsChanged = diffFields(
      atual as unknown as Record<string, unknown>,
      categoria as unknown as Record<string, unknown>,
      ['name', 'dreGroup', 'parentId', 'icon', 'color', 'isActive', 'visibleInRegimes', 'description', 'code', 'type', 'order'],
    )

    if (fieldsChanged) {
      await logAudit(ctx, {
        action: 'UPDATE',
        entityType: 'Category',
        entityId: categoria.id,
        fieldsChanged,
        metadata: { name: categoria.name },
        request,
      })
    }

    return NextResponse.json({ categoria })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/empresas/[id]/categorias/[catId]
// Default: soft delete (isActive=false). Preserva transações vinculadas.
//
// Query opcional ?hard=true: hard delete (DELETE row) APENAS se:
//   - !isSystemDefault (não é categoria do template)
//   - transactionCount === 0 (zero transações vinculadas)
//   - sem filhos (incluindo desativados — soft-deletados continuam ocupando
//     o espaço hierárquico)
// Validações via lib/categories/delete-rules.ts (mesmas regras do frontend).
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId, catId } = await params
    const isHardDelete = request.nextUrl.searchParams.get('hard') === 'true'

    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission(isHardDelete ? 'category.delete' : 'category.deactivate')

    const atual = await prisma.category.findFirst({
      where: { id: catId, companyId: empresaId },
    })
    if (!atual) {
      return NextResponse.json({ erro: 'Categoria não encontrada' }, { status: 404 })
    }

    if (isHardDelete) {
      // Conta filhos (incluindo inativos) e transações
      const [transactionCount, childrenCount] = await Promise.all([
        prisma.transaction.count({ where: { categoryId: catId } }),
        prisma.category.count({ where: { parentId: catId } }),
      ])

      const hardCtx = {
        isSystemDefault: atual.isSystemDefault,
        transactionCount,
        childrenCount,
      }

      if (!canHardDelete(hardCtx)) {
        const motivo = getHardDeleteDisabledReason(hardCtx) ?? 'Não foi possível excluir'
        return NextResponse.json({ erro: motivo }, { status: 400 })
      }

      await prisma.category.delete({ where: { id: catId } })

      await logAudit(ctx, {
        action: 'DELETE',
        entityType: 'Category',
        entityId: catId,
        metadata: { name: atual.name, hardDelete: true },
        request,
      })

      return NextResponse.json({
        success: true,
        deleted: true,
        mensagem: 'Categoria excluída permanentemente',
      })
    }

    // Soft delete padrão
    await prisma.category.update({
      where: { id: catId },
      data: { isActive: false },
    })

    await logAudit(ctx, {
      action: 'DEACTIVATE',
      entityType: 'Category',
      entityId: catId,
      metadata: { name: atual.name, hardDelete: false },
      request,
    })

    return NextResponse.json({ mensagem: 'Categoria desativada com sucesso' })
  } catch (error) {
    return handleApiError(error)
  }
}
