// Sprint 5.0.4.0b Fase 5 — Endpoint Folha.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { computePayroll } from '@/lib/relatorios/payroll'

export const runtime = 'nodejs'

const querySchema = z.object({
  from: z.string().date(),
  to: z.string().date(),
  tipo: z.string().optional(),
})

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('dre.view')

    const sp = request.nextUrl.searchParams
    const input = querySchema.parse(Object.fromEntries(sp.entries()))

    const start = new Date(`${input.from}T00:00:00.000Z`)
    const end = new Date(`${input.to}T23:59:59.999Z`)

    const [grouped, employees, totalAtivos] = await Promise.all([
      prisma.transaction.groupBy({
        by: ['employeeId'],
        where: {
          OR: [
            { bankAccount: { companyId: empresaId } },
            { employee: { companyId: empresaId } },
          ],
          lifecycle: 'EFFECTED',
          reconciledWithId: null,
          type: 'DEBIT',
          employeeId: { not: null },
          date: { gte: start, lte: end },
        },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.employee.findMany({
        where: { companyId: empresaId },
        select: { id: true, nome: true, tipo: true, ativo: true },
      }),
      prisma.employee.count({
        where: { companyId: empresaId, ativo: true },
      }),
    ])

    const result = computePayroll({
      aggregated: grouped
        .filter((g) => !!g.employeeId)
        .map((g) => ({
          employeeId: g.employeeId!,
          amount: g._sum.amount ?? 0,
          count: g._count,
        })),
      employees,
      totalFuncionariosAtivos: totalAtivos,
    })

    // Filtro opcional por tipo (post-compute)
    const filteredRows = input.tipo
      ? result.rows.filter((r) => r.tipo === input.tipo)
      : result.rows

    return NextResponse.json({
      ...result,
      rows: filteredRows,
      period: { from: input.from, to: input.to },
      filterTipo: input.tipo ?? null,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
