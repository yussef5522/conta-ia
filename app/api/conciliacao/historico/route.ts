// Sprint A-effected Fase 1 — GET /api/conciliacao/historico
//
// Lista paginada de conciliações já feitas (candidatos com reconciledWithId).
// Inclui dados do OFX linkado em cada item (1 query agregada via Map lookup,
// evita N+1 no client).
//
// Filtros:
//   - empresaId (multi-tenant obrigatório)
//   - busca (descrição contém — candidato OU OFX)
//   - page, limit (paginação default 25 / max 100)
//
// Ordenação: updatedAt DESC (mais recente primeiro — proxy de "conciliada em").

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'

const querySchema = z.object({
  empresaId: z.string().cuid(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  busca: z.string().trim().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const data = querySchema.parse(Object.fromEntries(url.searchParams))

    const ctx = await getAuthContext(request, data.empresaId)
    ctx.requirePermission('transaction.view')

    const companyScope = {
      OR: [
        { bankAccount: { companyId: data.empresaId } },
        { supplier: { companyId: data.empresaId } },
        { customer: { companyId: data.empresaId } },
        { category: { companyId: data.empresaId } },
      ],
    }

    const where = {
      reconciledWithId: { not: null },
      AND: [
        companyScope,
        ...(data.busca
          ? [{ description: { contains: data.busca, mode: 'insensitive' as const } }]
          : []),
      ],
    }

    const [total, items] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (data.page - 1) * data.limit,
        take: data.limit,
        select: {
          id: true,
          description: true,
          amount: true,
          paymentDate: true,
          dueDate: true,
          date: true,
          origin: true,
          lifecycle: true,
          status: true,
          reconciledWithId: true,
          updatedAt: true,
          category: { select: { id: true, name: true, color: true } },
          supplier: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
        },
      }),
    ])

    // Enriquece com OFX linkado (1 query agregada)
    const ofxIds = items.map((i) => i.reconciledWithId).filter((id): id is string => !!id)
    const ofxs =
      ofxIds.length > 0
        ? await prisma.transaction.findMany({
            where: { id: { in: ofxIds } },
            select: {
              id: true,
              description: true,
              amount: true,
              date: true,
              type: true,
              bankAccount: { select: { name: true, bankName: true } },
            },
          })
        : []
    const ofxById = new Map(ofxs.map((o) => [o.id, o]))

    const enriched = items.map((item) => ({
      ...item,
      ofx: item.reconciledWithId ? ofxById.get(item.reconciledWithId) ?? null : null,
    }))

    return NextResponse.json({
      items: enriched,
      total,
      page: data.page,
      limit: data.limit,
      totalPages: Math.ceil(total / data.limit),
    })
  } catch (error) {
    return handleApiError(error)
  }
}
