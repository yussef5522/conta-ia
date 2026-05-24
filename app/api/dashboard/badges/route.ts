// Sprint 4.0.3 — GET /api/dashboard/badges?empresaId=...
// Retorna contadores pra badges do sidebar (polling 60s).

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const empresaId = sp.get('empresaId')
    if (!empresaId) {
      return NextResponse.json({ erro: 'empresaId obrigatório' }, { status: 400 })
    }

    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.view')

    const now = new Date()
    const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)

    // Tenant filter: usa OR pra pegar tx sem bankAccount (PAYABLE/RECEIVABLE sem conta)
    const tenantOR = {
      OR: [
        { bankAccount: { companyId: empresaId } },
        { supplier: { companyId: empresaId } },
        { customer: { companyId: empresaId } },
        { category: { companyId: empresaId } },
      ],
    }

    const [vencidas, vencendoEm3, conciliacaoPendente] = await Promise.all([
      prisma.transaction.count({
        where: {
          ...tenantOR,
          lifecycle: { in: ['PAYABLE', 'RECEIVABLE'] },
          status: 'PENDING',
          dueDate: { lt: now },
        },
      }),
      prisma.transaction.count({
        where: {
          ...tenantOR,
          lifecycle: { in: ['PAYABLE', 'RECEIVABLE'] },
          status: 'PENDING',
          dueDate: { gte: now, lte: in3Days },
        },
      }),
      // Tx OFX EFFECTED sem conciliação (candidatas a wizard)
      prisma.transaction.count({
        where: {
          bankAccount: { companyId: empresaId },
          lifecycle: 'EFFECTED',
          origin: 'OFX',
          reconciledWithId: null,
          status: { not: 'IGNORED' },
        },
      }),
    ])

    return NextResponse.json({
      contasAPagar: {
        vencidas,
        vencendoEm3Dias: vencendoEm3,
      },
      conciliacao: {
        pendentes: conciliacaoPendente,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
