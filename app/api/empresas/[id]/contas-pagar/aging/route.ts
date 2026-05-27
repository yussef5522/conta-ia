// Sprint 5.0.3.0c (c4) — GET aging buckets de PAYABLE vencidas.
//
// Calcula no servidor (não pagina o client) pra suportar empresa com 1000+
// contas vencidas. Reusa lib pura `lib/contas-pagar/aging.ts`.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { computeAging } from '@/lib/contas-pagar/aging'

interface Params {
  params: Promise<{ id: string }>
}

export const runtime = 'nodejs'

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.view')

    const now = new Date()

    // Busca TODAS as PAYABLE PENDING com dueDate no passado da empresa.
    // Cap razoável (10k) pra não estourar memória.
    const rows = await prisma.transaction.findMany({
      where: {
        lifecycle: 'PAYABLE',
        status: 'PENDING',
        dueDate: { lt: now },
        paymentDate: null,
        OR: [
          { supplier: { companyId: empresaId } },
          { employee: { companyId: empresaId } },
          { category: { companyId: empresaId } },
          { bankAccount: { companyId: empresaId } },
        ],
      },
      select: {
        status: true,
        dueDate: true,
        paymentDate: true,
        amount: true,
      },
      take: 10_000,
    })

    const aging = computeAging(rows, now)

    return NextResponse.json({ aging, computedAt: now.toISOString() })
  } catch (error) {
    return handleApiError(error)
  }
}
