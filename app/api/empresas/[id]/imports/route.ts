// GET /api/empresas/[id]/imports — lista histórico de imports OFX da empresa.
// Sprint 2.3 Onda 2.

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
    const { id: empresaId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.view')

    const url = request.nextUrl
    const status = url.searchParams.get('status') ?? 'ALL'
    const bankAccountId = url.searchParams.get('bankAccountId') ?? undefined
    const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'))
    const pageSize = 10

    const where: Prisma.OfxImportWhereInput = {
      bankAccount: { companyId: empresaId },
    }
    if (status !== 'ALL') where.status = status
    if (bankAccountId) where.bankAccountId = bankAccountId

    const [total, items] = await Promise.all([
      prisma.ofxImport.count({ where }),
      prisma.ofxImport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          bankAccount: { select: { id: true, name: true, bankName: true } },
          user: { select: { id: true, name: true, email: true } },
          revertedBy: { select: { id: true, name: true } },
        },
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
    })
  } catch (err) {
    return handleApiError(err)
  }
}
