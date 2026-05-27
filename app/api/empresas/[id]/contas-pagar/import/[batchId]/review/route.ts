// Sprint 5.0.2.0 — GET rows do staging pra UI step REVIEW.
// Carrega StagedPayableRow + match data (Supplier/Employee/Category) pra UI.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'

interface Params {
  params: Promise<{ id: string; batchId: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId, batchId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.view')

    const batch = await prisma.excelImportBatch.findFirst({
      where: { id: batchId, companyId },
    })
    if (!batch) {
      return NextResponse.json({ erro: 'Batch não encontrado' }, { status: 404 })
    }

    const rowsRaw = await prisma.stagedPayableRow.findMany({
      where: { batchId },
      orderBy: { rowIndex: 'asc' },
    })

    // Resolve nome de Category pra mostrar no UI
    const catIds = Array.from(
      new Set(rowsRaw.map((r) => r.matchedCategoryId).filter((x): x is string => !!x)),
    )
    const cats = catIds.length
      ? await prisma.category.findMany({
          where: { id: { in: catIds } },
          select: { id: true, name: true },
        })
      : []
    const catNameById = new Map(cats.map((c) => [c.id, c.name]))

    const rows = rowsRaw.map((r) => ({
      id: r.id,
      rowIndex: r.rowIndex,
      rawFavorecido: r.rawFavorecido,
      rawDescricao: r.rawDescricao,
      rawCentroCusto: r.rawCentroCusto,
      valor: r.valor,
      vencimento: r.vencimento?.toISOString() ?? null,
      pagamento: r.pagamento?.toISOString() ?? null,
      paymentStatus: r.paymentStatus,
      favorecidoType: r.favorecidoType,
      favorecidoConfidence: r.favorecidoConfidence,
      categoryConfidence: r.categoryConfidence,
      matchedSupplierId: r.matchedSupplierId,
      matchedEmployeeId: r.matchedEmployeeId,
      matchedCategoryName: r.matchedCategoryId
        ? catNameById.get(r.matchedCategoryId) ?? null
        : null,
      proposedCategoryName: r.proposedCategoryName,
      duplicateOf: r.duplicateOf,
      userDecision: r.userDecision,
    }))

    return NextResponse.json({ batchId, rows })
  } catch (error) {
    return handleApiError(error)
  }
}
