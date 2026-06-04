// Sprint A-effected Fase B.3 — POST /api/conciliacao/desfazer-grupo/[groupId]
//
// Reverte um N:1 inteiro: lookup de todas as candidates com o mesmo
// reconcileGroupId e chama undoReconciliation em cada uma atomic.
//
// Caso CIA DA FRUTA: as 7 notas voltam a "PAYABLE pendentes" (ou
// EFFECTED órfãs) e o PIX OFX volta a ter `reconciledFrom = []`,
// disponível pra novo reconcile.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import {
  undoReconciliation,
  ReconciliationError,
} from '@/lib/conciliacao/reconcile'

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

    // Lookup candidates do grupo
    const candidates = await prisma.transaction.findMany({
      where: { reconcileGroupId: groupId },
      select: {
        id: true,
        bankAccount: { select: { companyId: true } },
        supplier: { select: { companyId: true } },
        customer: { select: { companyId: true } },
        category: { select: { companyId: true } },
      },
    })

    if (candidates.length === 0) {
      return NextResponse.json(
        { erro: 'Grupo não encontrado (ou já foi desfeito)' },
        { status: 404 },
      )
    }

    // Resolve companyId via primeira candidate
    const first = candidates[0]
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

    // Atomic loop: undoReconciliation em cada candidate
    let undone = 0
    let failed = 0
    const errors: Array<{ candidateId: string; error: string }> = []

    for (const c of candidates) {
      try {
        await undoReconciliation(c.id, ctx)
        undone += 1
      } catch (e) {
        failed += 1
        errors.push({
          candidateId: c.id,
          error: e instanceof ReconciliationError ? e.reason : 'Erro desconhecido',
        })
      }
    }

    return NextResponse.json({
      ok: failed === 0,
      groupId,
      undone,
      failed,
      total: candidates.length,
      errors,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
