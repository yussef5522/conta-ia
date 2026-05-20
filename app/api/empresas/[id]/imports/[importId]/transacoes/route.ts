// GET /api/empresas/[id]/imports/[importId]/transacoes — Sprint 2.3.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'

interface Params {
  params: Promise<{ id: string; importId: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId, importId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.view')

    // Valida que import pertence à empresa
    const imp = await prisma.ofxImport.findFirst({
      where: { id: importId, bankAccount: { companyId: empresaId } },
      select: { id: true },
    })
    if (!imp) {
      return NextResponse.json(
        { erro: 'Import não encontrado' },
        { status: 404 },
      )
    }

    const page = Math.max(
      1,
      Number(request.nextUrl.searchParams.get('page') ?? '1'),
    )
    const pageSize = 25

    const [total, items] = await Promise.all([
      prisma.transaction.count({ where: { importId } }),
      prisma.transaction.findMany({
        where: { importId },
        orderBy: { date: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          date: true,
          description: true,
          amount: true,
          type: true,
          status: true,
          classificationSource: true,
          category: { select: { id: true, name: true } },
          supplier: { select: { id: true, razaoSocial: true } },
        },
      }),
    ])

    return NextResponse.json({
      transacoes: items,
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
