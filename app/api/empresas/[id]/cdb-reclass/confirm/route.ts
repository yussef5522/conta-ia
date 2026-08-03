// Sprint CDB/Royalties (02/08/2026) — POST confirma a reclassificação de CDB.
// Grava SÓ categoryId + status (escada) nas tx confirmadas, DENTRO de $transaction.
// NUNCA toca amount/date/balance. Aceita só categorias-alvo de CDB da empresa.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { statusFromCategoryId } from '@/lib/transacoes/needs-review'
import { CDB_TARGET_CATEGORY } from '@/lib/cdb/detect'

export const runtime = 'nodejs'
interface Params { params: Promise<{ id: string }> }

const bodySchema = z.object({
  assignments: z.array(z.object({ txId: z.string().min(1), categoryId: z.string().min(1) })).min(1).max(1000),
})

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.update')

    const body = bodySchema.parse(await request.json())

    // Categorias-alvo válidas de CDB DESTA empresa (isolamento + só CDB).
    const targetCats = await prisma.category.findMany({
      where: { companyId: empresaId, name: { in: Object.values(CDB_TARGET_CATEGORY) } },
      select: { id: true },
    })
    const validCatIds = new Set(targetCats.map((c) => c.id))

    let written = 0, skipped = 0
    await prisma.$transaction(async (tx) => {
      const ids = body.assignments.map((a) => a.txId)
      // Só tx EFFECTED desta empresa (multi-tenant).
      const existentes = await tx.transaction.findMany({
        where: { id: { in: ids }, bankAccount: { companyId: empresaId }, lifecycle: 'EFFECTED' },
        select: { id: true },
      })
      const okIds = new Set(existentes.map((e) => e.id))

      for (const a of body.assignments) {
        if (!okIds.has(a.txId) || !validCatIds.has(a.categoryId)) { skipped++; continue }
        await tx.transaction.update({
          where: { id: a.txId },
          // SÓ categoria + status pela escada. Nada de amount/date/balance.
          data: {
            categoryId: a.categoryId,
            status: statusFromCategoryId(a.categoryId),
            classificationSource: 'MANUAL',
          },
        })
        written++
      }
    })

    return NextResponse.json({ written, skipped })
  } catch (error) {
    return handleApiError(error)
  }
}
