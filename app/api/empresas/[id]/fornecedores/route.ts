// GET, POST /api/empresas/[id]/fornecedores — Sprint 2.2 Onda 2.

import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { logAudit } from '@/lib/audit'
import {
  createFornecedorSchema,
  listFornecedoresQuerySchema,
} from '@/lib/validations/fornecedor'

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.view')

    const url = request.nextUrl
    const parsed = listFornecedoresQuerySchema.safeParse({
      q: url.searchParams.get('q') ?? undefined,
      fonte: url.searchParams.get('fonte') ?? undefined,
      categoryId: url.searchParams.get('categoryId') ?? undefined,
      comCnpj: url.searchParams.get('comCnpj') ?? undefined,
      isActive: url.searchParams.get('isActive') ?? undefined,
      page: url.searchParams.get('page') ?? undefined,
      pageSize: url.searchParams.get('pageSize') ?? undefined,
    })
    if (!parsed.success) {
      return NextResponse.json({ erro: 'Filtros inválidos' }, { status: 400 })
    }
    const { q, fonte, categoryId, comCnpj, isActive, page, pageSize } =
      parsed.data

    const where: Prisma.SupplierWhereInput = { companyId: empresaId }
    if (q) {
      where.OR = [
        { razaoSocial: { contains: q } },
        { nomeFantasia: { contains: q } },
        { cnpj: { contains: q.replace(/\D/g, '') } },
      ]
    }
    if (fonte !== 'ALL') where.fonte = fonte
    if (categoryId) where.categoryId = categoryId
    if (comCnpj === 'true') where.cnpj = { not: null }
    if (comCnpj === 'false') where.cnpj = null
    if (isActive !== 'all') where.isActive = isActive === 'true'

    const [total, items, statsRaw] = await Promise.all([
      prisma.supplier.count({ where }),
      prisma.supplier.findMany({
        where,
        orderBy: [{ razaoSocial: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          category: { select: { id: true, name: true, color: true } },
          _count: { select: { transactions: true } },
        },
      }),
      prisma.supplier.groupBy({
        by: ['fonte'],
        where: { companyId: empresaId, isActive: true },
        _count: { id: true },
      }),
    ])

    // Top 5 por valor (último mês)
    const seisMesesAtras = new Date()
    seisMesesAtras.setMonth(seisMesesAtras.getMonth() - 6)
    const topPorValor = await prisma.transaction.groupBy({
      by: ['supplierId'],
      where: {
        bankAccount: { companyId: empresaId },
        supplierId: { not: null },
        date: { gte: seisMesesAtras },
      },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 5,
    })

    const topSupplierIds = topPorValor
      .map((t) => t.supplierId)
      .filter((id): id is string => id !== null)
    const topSuppliers =
      topSupplierIds.length > 0
        ? await prisma.supplier.findMany({
            where: { id: { in: topSupplierIds } },
            select: { id: true, razaoSocial: true, nomeFantasia: true },
          })
        : []
    const topPorValorEnriched = topPorValor.map((t) => {
      const sup = topSuppliers.find((s) => s.id === t.supplierId)
      return {
        supplierId: t.supplierId,
        nome: sup?.nomeFantasia ?? sup?.razaoSocial ?? '—',
        total: Number(t._sum.amount ?? 0),
      }
    })

    const statsByFonte: Record<string, number> = {
      MANUAL: 0,
      BRASILAPI: 0,
      CLAUDE: 0,
      KEYWORD: 0,
    }
    for (const s of statsRaw) {
      statsByFonte[s.fonte] = s._count.id
    }

    return NextResponse.json({
      items: items.map((s) => ({
        ...s,
        transacoesCount: s._count.transactions,
      })),
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
      stats: {
        totalAtivos:
          statsByFonte.MANUAL +
          statsByFonte.BRASILAPI +
          statsByFonte.CLAUDE +
          statsByFonte.KEYWORD,
        porFonte: statsByFonte,
        topPorValor: topPorValorEnriched,
      },
    })
  } catch (err) {
    return handleApiError(err)
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.create')

    const body = await request.json()
    const data = createFornecedorSchema.parse(body)

    if (data.categoryId) {
      const cat = await prisma.category.findFirst({
        where: { id: data.categoryId, companyId: empresaId },
        select: { id: true },
      })
      if (!cat) {
        return NextResponse.json(
          { erro: 'Categoria inválida' },
          { status: 400 },
        )
      }
    }

    // Conflito de CNPJ na mesma empresa (@@unique)
    if (data.cnpj) {
      const exists = await prisma.supplier.findFirst({
        where: { companyId: empresaId, cnpj: data.cnpj },
        select: { id: true, razaoSocial: true },
      })
      if (exists) {
        return NextResponse.json(
          {
            erro: `Já existe fornecedor com esse CNPJ: ${exists.razaoSocial}.`,
            supplierId: exists.id,
          },
          { status: 409 },
        )
      }
    }

    const created = await prisma.supplier.create({
      data: {
        companyId: empresaId,
        razaoSocial: data.razaoSocial,
        nomeFantasia: data.nomeFantasia ?? null,
        cnpj: data.cnpj || null,
        categoryId: data.categoryId ?? null,
        notes: data.notes ?? null,
        fonte: 'MANUAL',
        isActive: true,
      },
      include: {
        category: { select: { id: true, name: true, color: true } },
      },
    })

    await logAudit(ctx, {
      action: 'SUPPLIER_CREATED',
      entityType: 'Supplier',
      entityId: created.id,
      metadata: {
        razaoSocial: created.razaoSocial,
        cnpj: created.cnpj,
        fonte: 'MANUAL',
      },
      request,
    })

    return NextResponse.json({ fornecedor: created }, { status: 201 })
  } catch (err) {
    return handleApiError(err)
  }
}
