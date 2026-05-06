import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { generateAuditCSV } from '@/lib/audit-csv'

interface Params {
  params: Promise<{ id: string }>
}

const MAX_EXPORT = 10_000

// GET /api/empresas/[id]/audit-log/export
// Exporta logs em CSV com mesmos filtros do GET regular.
// Limite: 10.000 registros por export. Avisa user se exceder.
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('audit.export')

    const url = new URL(request.url)

    // Filtros (mesmos do GET principal)
    const where: Record<string, unknown> = { companyId }
    const userId = url.searchParams.get('userId')
    const action = url.searchParams.get('action')
    const entityType = url.searchParams.get('entityType')
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')
    const search = url.searchParams.get('search')

    if (userId) where.userId = userId
    if (action) where.action = action
    if (entityType) where.entityType = entityType
    if (startDate || endDate) {
      const range: Record<string, Date> = {}
      if (startDate) range.gte = new Date(startDate)
      if (endDate) range.lte = new Date(endDate)
      where.timestamp = range
    }
    if (search) {
      where.OR = [
        { userName: { contains: search } },
        { entityId: { contains: search } },
      ]
    }

    // Conta antes pra avisar se excede o limite
    const total = await prisma.auditLog.count({ where })

    if (total > MAX_EXPORT) {
      return NextResponse.json(
        {
          erro: `Export limitado a ${MAX_EXPORT} registros. Sua busca tem ${total}. Refine os filtros.`,
          total,
          maxAllowed: MAX_EXPORT,
        },
        { status: 400 },
      )
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: MAX_EXPORT,
    })

    const csv = generateAuditCSV(logs)
    const fileName = `auditoria-${companyId}-${new Date().toISOString().split('T')[0]}.csv`

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
