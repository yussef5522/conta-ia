// Sprint A-effected Fase B.3 + B.4.1 — POST /api/conciliacao/desfazer-grupo/[groupId]
//
// Reverte um grupo N:1 inteiro:
//   - Candidates normais (PAYABLE/RECEIVABLE/EFFECTED órfão) → undoReconciliation
//     (limpa reconciledWithId + reconcileGroupId + restaura state via audit)
//   - Tx de ajuste (origin='ADJUSTMENT', Fase B.4.1) → DELETE atomic
//     (justificativa: ajuste só existia em função da conciliação; sem ela
//     não faz sentido. Audit log preserva histórico pra forense.)
//
// Caso CIA DA FRUTA: 7 notas voltam a "PAYABLE pendentes" (ou EFFECTED
// órfãs) e o PIX OFX volta a ter reconciledFrom = [], disponível pra
// novo reconcile.
//
// Caso boleto+juros B.4.1: 1 AP volta a PAYABLE pendente; tx de ajuste
// "Juros R$ 70" é DELETED (entityType='Adjustment', action='DELETE_UNDO').

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import {
  undoReconciliation,
  ReconciliationError,
} from '@/lib/conciliacao/reconcile'
import { logAudit } from '@/lib/audit'

const paramSchema = z.object({
  groupId: z.string().min(8).max(50),
})

interface Params {
  params: Promise<{ groupId: string }>
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const raw = await params
    const { groupId } = paramSchema.parse(raw)

    // Lookup TODAS as txs do grupo, incluindo ajustes (origin='ADJUSTMENT').
    const members = await prisma.transaction.findMany({
      where: { reconcileGroupId: groupId },
      select: {
        id: true,
        origin: true,
        amount: true,
        description: true,
        categoryId: true,
        type: true,
        bankAccount: { select: { companyId: true } },
        supplier: { select: { companyId: true } },
        customer: { select: { companyId: true } },
        category: { select: { companyId: true } },
      },
    })

    if (members.length === 0) {
      return NextResponse.json(
        { erro: 'Grupo não encontrado (ou já foi desfeito)' },
        { status: 404 },
      )
    }

    // Resolve companyId
    const first = members[0]
    const companyId =
      first.bankAccount?.companyId ??
      first.supplier?.companyId ??
      first.customer?.companyId ??
      first.category?.companyId
    if (!companyId) {
      return NextResponse.json({ erro: 'Empresa não resolvida' }, { status: 422 })
    }

    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.update')

    // Separa candidates de adjustments
    const adjustments = members.filter((m) => m.origin === 'ADJUSTMENT')
    const candidates = members.filter((m) => m.origin !== 'ADJUSTMENT')

    let undone = 0
    let adjustmentsDeleted = 0
    let failed = 0
    const errors: Array<{ id: string; error: string }> = []

    // 1) Undo das candidates normais (reusa undoReconciliation Sprint A-effected)
    for (const c of candidates) {
      try {
        await undoReconciliation(c.id, ctx)
        undone += 1
      } catch (e) {
        failed += 1
        errors.push({
          id: c.id,
          error: e instanceof ReconciliationError ? e.reason : 'Erro desconhecido',
        })
      }
    }

    // 2) DELETE atomic dos adjustments (Fase B.4.1)
    if (adjustments.length > 0) {
      await prisma.$transaction(async (trx) => {
        for (const adj of adjustments) {
          // Audit ANTES de deletar (preserva metadata pro histórico forense)
          await logAudit(
            ctx,
            {
              action: 'DELETE',
              entityType: 'Adjustment',
              entityId: adj.id,
              metadata: {
                reason: 'desfazer-grupo cascade',
                reconcileGroupId: groupId,
                origin: 'ADJUSTMENT',
                amount: adj.amount,
                description: adj.description,
                categoryId: adj.categoryId,
                type: adj.type,
              },
            },
            trx,
          )
          await trx.transaction.delete({ where: { id: adj.id } })
          adjustmentsDeleted += 1
        }
      })
    }

    return NextResponse.json({
      ok: failed === 0,
      groupId,
      undone,
      adjustmentsDeleted,
      failed,
      total: members.length,
      errors,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
