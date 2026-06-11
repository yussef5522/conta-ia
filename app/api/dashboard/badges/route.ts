// Sprint 4.0.3 — GET /api/dashboard/badges?empresaId=...
// Retorna contadores pra badges do sidebar (polling 60s).

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import {
  defaultTipoForCompany,
  getTipoFilter,
} from '@/lib/conciliacao/tipo-filter'

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const empresaId = sp.get('empresaId')
    if (!empresaId) {
      return NextResponse.json({ erro: 'empresaId obrigatório' }, { status: 400 })
    }

    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.view')

    // B1 + B2 (09/06/2026): badge da Conciliação tem que casar com a tela.
    // Carrega companyType pra aplicar a MESMA heurística de tipo que a UI usa
    // por default (restaurant/retail/industry → apenas-pagamentos; resto →
    // todos). Sem isso o badge contava CREDIT que a tela escondia.
    const empresa = await prisma.company.findUnique({
      where: { id: empresaId },
      select: { type: true },
    })
    const tipoDefault = defaultTipoForCompany(empresa?.type)
    const tipoFilter = getTipoFilter(tipoDefault)

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
      // B1 (09/06/2026): transferGroupId IS NULL + type != 'TRANSFER' —
      //   transferência pareada não é trabalho de conciliação.
      // B2 (09/06/2026): tipoFilter por defaultTipoForCompany pra contador
      //   bater com o que a tela mostra por default. Se tipoFilter.type
      //   estiver setado (DEBIT/CREDIT), já cobre "!= TRANSFER" naturalmente.
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
          transferGroupId: null,
          ...(tipoFilter.type
            ? { type: tipoFilter.type }
            : { type: { not: 'TRANSFER' } }),
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
          // Fix Badge-Pendentes (11/06/2026): alinha com /api/transacoes?
          // semCategoria=true que aplicou Fix B3 ontem mas o badge ficou
          // pra trás. Sintoma: pareou 3 transferências hoje (R$ 20.300 +
          // R$ 3.000), elas ficaram com type=TRANSFER + categoryId=null +
          // status=PENDING; tela /pendentes esconde TRANSFER pareada, badge
          // continuava contando como "trabalho a fazer".
          transferGroupId: null,
          type: { not: 'TRANSFER' },
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
