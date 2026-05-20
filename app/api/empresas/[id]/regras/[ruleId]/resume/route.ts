// POST /api/empresas/[id]/regras/[ruleId]/resume — Sprint 2.1.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { logAudit } from '@/lib/audit'

interface Params {
  params: Promise<{ id: string; ruleId: string }>
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId, ruleId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.update')

    const existing = await prisma.aiLearningRule.findFirst({
      where: { id: ruleId, companyId: empresaId },
    })
    if (!existing) {
      return NextResponse.json({ erro: 'Regra não encontrada' }, { status: 404 })
    }
    if (existing.isActive) {
      return NextResponse.json(
        { erro: 'Regra já está ativa' },
        { status: 409 },
      )
    }

    await prisma.aiLearningRule.update({
      where: { id: ruleId },
      data: { isActive: true },
    })

    await logAudit(ctx, {
      action: 'RULE_RESUMED',
      entityType: 'AiLearningRule',
      entityId: ruleId,
      metadata: { padrao: existing.padrao },
      request,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    return handleApiError(err)
  }
}
