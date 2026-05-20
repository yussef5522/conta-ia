// GET /api/empresas/[id]/fornecedores/[supplierId]/transacoes — Sprint 2.2.
// Histórico de transações + estatísticas agregadas.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'

interface Params {
  params: Promise<{ id: string; supplierId: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId, supplierId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.view')

    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, companyId: empresaId },
      select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true },
    })
    if (!supplier) {
      return NextResponse.json(
        { erro: 'Fornecedor não encontrado' },
        { status: 404 },
      )
    }

    const page = Math.max(
      1,
      Number(request.nextUrl.searchParams.get('page') ?? '1'),
    )
    const pageSize = 20

    const [total, items, stats] = await Promise.all([
      prisma.transaction.count({
        where: { supplierId, bankAccount: { companyId: empresaId } },
      }),
      prisma.transaction.findMany({
        where: { supplierId, bankAccount: { companyId: empresaId } },
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
          bankAccount: { select: { id: true, bankName: true, accountNumber: true } },
          category: { select: { id: true, name: true } },
        },
      }),
      prisma.transaction.aggregate({
        where: { supplierId, bankAccount: { companyId: empresaId } },
        _sum: { amount: true },
        _avg: { amount: true },
        _min: { date: true },
        _max: { date: true },
      }),
    ])

    return NextResponse.json({
      supplier,
      transacoes: items,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
      stats: {
        total: Number(stats._sum.amount ?? 0),
        media: Number(stats._avg.amount ?? 0),
        primeira: stats._min.date,
        ultima: stats._max.date,
      },
    })
  } catch (err) {
    return handleApiError(err)
  }
}
