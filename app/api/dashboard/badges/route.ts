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

    const [vencidas, vencendoEm3, conciliacaoPendente, transacoesPendentes] = await Promise.all([
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
      // Tx OFX EFFECTED a conciliar — IDÊNTICO ao filtro de
      // /api/conciliacao/ofx-pendentes pra badge bater com a aba.
      // Sprint Sync-Pendentes-Conciliacao: inclui categoryId IS NULL
      // (OFX categorizada via Pendentes/Create/regra IA sai da fila).
      prisma.transaction.count({
        where: {
          bankAccount: { companyId: empresaId },
          origin: 'OFX',
          lifecycle: 'EFFECTED',
          reconciledWithId: null,
          reconciledFrom: { none: {} },
          isInternalTransfer: false,
          ignoredAt: null,
          cashCoded: false,
          categoryId: null,
        },
      }),
      // Sprint Sync-Pendentes-Conciliacao: alinha filtro com a tela
      // /empresas/[id]/pendentes (semCategoria=true + status=PENDING) + exclui
      // tx já conciliadas via Match (reconciledFrom/reconciledWithId) cujo
      // status ficou PENDING por flow ORPHAN. Sem isso o badge contava
      // OFX conciliadas com backfill de categoria como se fossem trabalho.
      prisma.transaction.count({
        where: {
          bankAccount: { companyId: empresaId },
          lifecycle: 'EFFECTED',
          status: 'PENDING',
          categoryId: null,
          reconciledWithId: null,
          reconciledFrom: { none: {} },
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
      transacoesPendentes,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
