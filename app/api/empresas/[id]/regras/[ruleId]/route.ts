// GET, PATCH, DELETE /api/empresas/[id]/regras/[ruleId] — Sprint 2.1.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { logAudit } from '@/lib/audit'
import { updateRegraSchema } from '@/lib/validations/regra'

interface Params {
  params: Promise<{ id: string; ruleId: string }>
}

async function loadRule(empresaId: string, ruleId: string) {
  return prisma.aiLearningRule.findFirst({
    where: { id: ruleId, companyId: empresaId },
    include: {
      category: { select: { id: true, name: true, dreGroup: true, color: true } },
      supplier: { select: { id: true, razaoSocial: true, cnpj: true } },
    },
  })
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId, ruleId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.view')

    const rule = await loadRule(empresaId, ruleId)
    if (!rule) {
      return NextResponse.json({ erro: 'Regra não encontrada' }, { status: 404 })
    }

    // Conta quantas transações usam essa regra
    const transacoesCount = await prisma.transaction.count({
      where: { classifiedByRuleId: ruleId },
    })

    return NextResponse.json({ regra: rule, transacoesUsando: transacoesCount })
  } catch (err) {
    return handleApiError(err)
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId, ruleId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.update')

    const body = await request.json()
    const data = updateRegraSchema.parse(body)

    const existing = await loadRule(empresaId, ruleId)
    if (!existing) {
      return NextResponse.json({ erro: 'Regra não encontrada' }, { status: 404 })
    }

    // Se mudar categoryId, valida que pertence à empresa
    if (data.categoryId) {
      const cat = await prisma.category.findFirst({
        where: { id: data.categoryId, companyId: empresaId },
        select: { id: true },
      })
      if (!cat) {
        return NextResponse.json({ erro: 'Categoria inválida' }, { status: 400 })
      }
    }

    // Se mudar supplierId, valida que pertence à empresa
    if (data.supplierId) {
      const sup = await prisma.supplier.findFirst({
        where: { id: data.supplierId, companyId: empresaId },
        select: { id: true },
      })
      if (!sup) {
        return NextResponse.json({ erro: 'Fornecedor inválido' }, { status: 400 })
      }
    }

    const updated = await prisma.aiLearningRule.update({
      where: { id: ruleId },
      data,
      include: {
        category: { select: { id: true, name: true, dreGroup: true, color: true } },
        supplier: { select: { id: true, razaoSocial: true } },
      },
    })

    await logAudit(ctx, {
      action: 'RULE_UPDATED',
      entityType: 'AiLearningRule',
      entityId: ruleId,
      metadata: { changes: data, padrao: existing.padrao },
      request,
    })

    return NextResponse.json({ regra: updated })
  } catch (err) {
    return handleApiError(err)
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId, ruleId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.update')

    const existing = await loadRule(empresaId, ruleId)
    if (!existing) {
      return NextResponse.json({ erro: 'Regra não encontrada' }, { status: 404 })
    }

    // Solta as transações desta regra (set classifiedByRuleId=null)
    // pra não quebrar a FK Restrict implícita.
    await prisma.$transaction([
      prisma.transaction.updateMany({
        where: { classifiedByRuleId: ruleId },
        data: { classifiedByRuleId: null },
      }),
      prisma.aiLearningRule.delete({ where: { id: ruleId } }),
    ])

    await logAudit(ctx, {
      action: 'RULE_DELETED',
      entityType: 'AiLearningRule',
      entityId: ruleId,
      metadata: {
        padrao: existing.padrao,
        tipoMatch: existing.tipoMatch,
        vezesAplicada: existing.vezesAplicada,
      },
      request,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    return handleApiError(err)
  }
}
