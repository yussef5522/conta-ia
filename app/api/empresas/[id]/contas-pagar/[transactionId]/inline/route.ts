// Sprint 5.0.3.0c ELITE — PATCH inline edit cell.
//
// Body: { field, value } discriminated union (description/amount/dueDate/categoryId).
//
// Audit log GRANULAR — registra qual campo mudou + old/new value. Reusável
// pra /contas-receber e /movimentacoes no futuro (mesma assinatura).
//
// Especial: field=categoryId com sentinel "__create__:NomeNovo" CRIA categoria
// nova ANTES do update (sem race) e usa o id da nova.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { logAudit } from '@/lib/audit'
import {
  inlineEditSchema,
  isCreateCategorySentinel,
  extractCategoryName,
} from '@/lib/validations/saved-view'

interface Params {
  params: Promise<{ id: string; transactionId: string }>
}

export const runtime = 'nodejs'

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId, transactionId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.update')

    // Carrega a tx com escopo multi-tenant via OR
    const antiga = await prisma.transaction.findFirst({
      where: {
        id: transactionId,
        lifecycle: 'PAYABLE',
        OR: [
          { supplier: { companyId: empresaId } },
          { employee: { companyId: empresaId } },
          { category: { companyId: empresaId } },
          { bankAccount: { companyId: empresaId } },
        ],
      },
    })
    if (!antiga) {
      return NextResponse.json(
        { erro: 'Conta não encontrada', code: 'TX_NOT_FOUND' },
        { status: 404 },
      )
    }

    const body = await request.json()
    const input = inlineEditSchema.parse(body)

    // ─── Resolve categoria nova quando field=categoryId + sentinel ────────
    let resolvedCategoryId: string | null | undefined = undefined
    let createdCategoryId: string | null = null
    if (input.field === 'categoryId') {
      if (input.value === null) {
        resolvedCategoryId = null
      } else if (isCreateCategorySentinel(input.value)) {
        const newName = extractCategoryName(input.value)
        if (!newName) {
          return NextResponse.json(
            { erro: 'Nome de categoria nova vazio', code: 'EMPTY_CATEGORY_NAME' },
            { status: 422 },
          )
        }
        // Verifica se já existe pra evitar duplicata
        const existing = await prisma.category.findFirst({
          where: { companyId: empresaId, name: newName, isActive: true },
        })
        if (existing) {
          resolvedCategoryId = existing.id
        } else {
          const created = await prisma.category.create({
            data: {
              companyId: empresaId,
              name: newName,
              type: 'EXPENSE',
              dreGroup: 'OUTRAS_DESPESAS',
              isActive: true,
              isSystemDefault: false,
            },
          })
          resolvedCategoryId = created.id
          createdCategoryId = created.id
        }
      } else {
        // CUID de categoria existente — valida multi-tenant
        const cat = await prisma.category.findFirst({
          where: { id: input.value, companyId: empresaId },
        })
        if (!cat) {
          return NextResponse.json(
            { erro: 'Categoria não encontrada', code: 'CATEGORY_NOT_FOUND' },
            { status: 404 },
          )
        }
        resolvedCategoryId = cat.id
      }
    }

    // ─── Aplica update + audit log ─────────────────────────────────────
    const updated = await prisma.$transaction(async (tx) => {
      const data: Record<string, unknown> = {}
      let oldValue: unknown
      let newValue: unknown
      switch (input.field) {
        case 'description':
          data.description = input.value
          oldValue = antiga.description
          newValue = input.value
          break
        case 'amount':
          data.amount = input.value
          oldValue = antiga.amount
          newValue = input.value
          break
        case 'dueDate':
          data.dueDate = input.value
          oldValue = antiga.dueDate?.toISOString() ?? null
          newValue = input.value.toISOString()
          break
        case 'categoryId':
          data.categoryId = resolvedCategoryId
          oldValue = antiga.categoryId
          newValue = resolvedCategoryId
          break
      }

      const result = await tx.transaction.update({
        where: { id: transactionId },
        data,
        include: {
          category: { select: { id: true, name: true, color: true } },
          supplier: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
          employee: { select: { id: true, nome: true } },
          bankAccount: { select: { id: true, name: true, bankName: true } },
        },
      })

      await logAudit(
        ctx,
        {
          action: 'UPDATE',
          entityType: 'Transaction',
          entityId: transactionId,
          fieldsChanged: { [input.field]: { before: oldValue, after: newValue } },
          metadata: {
            source: 'inline-edit',
            field: input.field,
            createdCategoryId,
          },
          request,
        },
        tx,
      )
      return result
    })

    return NextResponse.json({
      transaction: updated,
      createdCategoryId,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
