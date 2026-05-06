import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'

interface Params {
  params: Promise<{ id: string }>
}

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  userId: z.string().optional(),
  action: z.string().optional(),
  entityType: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  search: z.string().optional(),
})

// GET /api/empresas/[id]/audit-log
// Lista audit logs paginado com filtros e meta-info pra dropdowns.
//
// Query params:
//   page (default 1)
//   limit (default 50, max 100)
//   userId, action, entityType (filtros)
//   startDate, endDate (ISO)
//   search (busca em userName, entityId)
//
// Retorna: { logs, total, page, limit, totalPages, meta: { users, actions, entityTypes } }
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('audit.view')

    const url = new URL(request.url)
    const query = querySchema.parse(Object.fromEntries(url.searchParams))

    // Multi-tenant: companyId sempre fixo
    const where: Record<string, unknown> = { companyId }

    if (query.userId) where.userId = query.userId
    if (query.action) where.action = query.action
    if (query.entityType) where.entityType = query.entityType

    if (query.startDate || query.endDate) {
      const range: Record<string, Date> = {}
      if (query.startDate) range.gte = new Date(query.startDate)
      if (query.endDate) range.lte = new Date(query.endDate)
      where.timestamp = range
    }

    if (query.search) {
      where.OR = [
        { userName: { contains: query.search } },
        { entityId: { contains: query.search } },
      ]
    }

    const skip = (query.page - 1) * query.limit

    // Queries paralelas: logs (com filtros) + total (com filtros) + meta (sem filtros)
    const [rawLogs, total, allUsers, allActions, allEntityTypes] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: query.limit,
        skip,
      }),
      prisma.auditLog.count({ where }),
      // Users distintos pra dropdown (escopo: empresa)
      prisma.auditLog.findMany({
        where: { companyId },
        distinct: ['userId'],
        select: { userId: true, userName: true, userEmail: true },
        take: 100,
      }),
      prisma.auditLog.findMany({
        where: { companyId },
        distinct: ['action'],
        select: { action: true },
      }),
      prisma.auditLog.findMany({
        where: { companyId },
        distinct: ['entityType'],
        select: { entityType: true },
      }),
    ])

    // Parse JSON strings de fieldsChanged e metadata pra UI já receber objects
    const logs = rawLogs.map((log) => ({
      ...log,
      fieldsChanged: log.fieldsChanged ? JSON.parse(log.fieldsChanged) : null,
      metadata: log.metadata ? JSON.parse(log.metadata) : null,
    }))

    return NextResponse.json({
      logs,
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
      meta: {
        users: allUsers
          .filter((u) => u.userId !== null)
          .map((u) => ({ id: u.userId, name: u.userName, email: u.userEmail })),
        actions: allActions.map((a) => a.action),
        entityTypes: allEntityTypes.map((e) => e.entityType),
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
