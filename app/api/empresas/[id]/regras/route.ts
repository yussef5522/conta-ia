// GET /api/empresas/[id]/regras — lista paginada de regras aprendidas
// Sprint 2.1 Onda 2.

import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { listRegrasQuerySchema } from '@/lib/validations/regra'

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.view')

    const url = request.nextUrl
    const parsed = listRegrasQuerySchema.safeParse({
      q: url.searchParams.get('q') ?? undefined,
      tipoMatch: url.searchParams.get('tipoMatch') ?? undefined,
      categoryId: url.searchParams.get('categoryId') ?? undefined,
      status: url.searchParams.get('status') ?? undefined,
      page: url.searchParams.get('page') ?? undefined,
      pageSize: url.searchParams.get('pageSize') ?? undefined,
    })
    if (!parsed.success) {
      return NextResponse.json({ erro: 'Filtros inválidos' }, { status: 400 })
    }
    const { q, tipoMatch, categoryId, status, page, pageSize } = parsed.data

    const where: Prisma.AiLearningRuleWhereInput = { companyId: empresaId }
    if (q) where.padrao = { contains: q }
    if (tipoMatch !== 'ALL') where.tipoMatch = tipoMatch
    if (categoryId) where.categoryId = categoryId
    if (status !== 'ALL') where.isActive = status === 'ACTIVE'

    const [total, items, statsRaw, topRulesRaw] = await Promise.all([
      prisma.aiLearningRule.count({ where }),
      prisma.aiLearningRule.findMany({
        where,
        orderBy: [{ vezesAplicada: 'desc' }, { updatedAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          category: { select: { id: true, name: true, dreGroup: true, color: true } },
          supplier: { select: { id: true, razaoSocial: true } },
        },
      }),
      prisma.aiLearningRule.aggregate({
        where: { companyId: empresaId, isActive: true },
        _count: { id: true },
        _avg: { confianca: true },
      }),
      prisma.aiLearningRule.findMany({
        where: { companyId: empresaId, isActive: true },
        orderBy: { vezesAplicada: 'desc' },
        take: 5,
        select: { id: true, padrao: true, vezesAplicada: true, tipoMatch: true },
      }),
    ])

    const ultimaRegra = await prisma.aiLearningRule.findFirst({
      where: { companyId: empresaId },
      orderBy: { createdAt: 'desc' },
      select: { padrao: true, createdAt: true },
    })

    // Sprint Regras-Cadastro (22/06/2026): marca tóxicas
    const { detectToxicPattern } = await import('@/lib/regras/detect-toxic')
    const itemsEnriquecidos = items.map((r) => {
      const tox = detectToxicPattern({ tipoMatch: r.tipoMatch, padrao: r.padrao })
      return {
        ...r,
        isToxic: tox.isToxic,
        toxicReason: tox.reason ?? null,
      }
    })

    return NextResponse.json({
      items: itemsEnriquecidos,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
      stats: {
        totalAtivas: statsRaw._count.id,
        confiancaMedia: statsRaw._avg.confianca ?? 0,
        topRules: topRulesRaw,
        ultimaRegra,
      },
    })
  } catch (err) {
    return handleApiError(err)
  }
}
