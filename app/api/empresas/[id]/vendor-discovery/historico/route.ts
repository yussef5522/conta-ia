// Sprint 5.0.2.n — GET /api/empresas/[id]/vendor-discovery/historico
// Lista discoveries da empresa pra auditoria.
//
// Filtros query: ?resultado=&origem=&userAction=&page=&pageSize=
// Stats: contagem por origem + custo total.

import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.view')

    const url = request.nextUrl
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10))
    const pageSize = Math.min(
      100,
      Math.max(10, parseInt(url.searchParams.get('pageSize') ?? '30', 10)),
    )

    const where: Prisma.VendorDiscoveryLogWhereInput = { companyId }
    const origem = url.searchParams.get('origem')
    if (origem) where.origem = origem
    const resultado = url.searchParams.get('resultado')
    if (resultado) where.resultado = resultado
    const userAction = url.searchParams.get('userAction')
    if (userAction) where.userAction = userAction

    const [total, items, stats] = await Promise.all([
      prisma.vendorDiscoveryLog.count({ where }),
      prisma.vendorDiscoveryLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.vendorDiscoveryLog.groupBy({
        by: ['origem'],
        where: { companyId },
        _count: { id: true },
        _sum: { custoApi: true },
      }),
    ])

    return NextResponse.json({
      items,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
      stats: stats.map((s) => ({
        origem: s.origem,
        count: s._count.id,
        custoTotalUsd: s._sum.custoApi ?? 0,
      })),
    })
  } catch (error) {
    return handleApiError(error)
  }
}
