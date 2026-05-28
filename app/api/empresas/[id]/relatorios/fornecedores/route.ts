// Sprint 5.0.4.0b Fase 4 — Endpoint Top Fornecedores.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { computeTopSuppliers } from '@/lib/relatorios/top-suppliers'

export const runtime = 'nodejs'

const querySchema = z.object({
  from: z.string().date(),
  to: z.string().date(),
  topN: z.coerce.number().int().min(1).max(50).default(10),
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

    // Calcular range do mês anterior (mesma duração)
    const durationMs = end.getTime() - start.getTime()
    const prevEnd = new Date(start.getTime() - 1)
    const prevStart = new Date(prevEnd.getTime() - durationMs)

    const [groupedCurrent, groupedPrev] = await Promise.all([
      prisma.transaction.groupBy({
        by: ['supplierId'],
        where: {
          OR: [
            { bankAccount: { companyId: empresaId } },
            { supplier: { companyId: empresaId } },
          ],
          lifecycle: 'EFFECTED',
          reconciledWithId: null,
          type: 'DEBIT',
          supplierId: { not: null },
          date: { gte: start, lte: end },
        },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.transaction.groupBy({
        by: ['supplierId'],
        where: {
          OR: [
            { bankAccount: { companyId: empresaId } },
            { supplier: { companyId: empresaId } },
          ],
          lifecycle: 'EFFECTED',
          reconciledWithId: null,
          type: 'DEBIT',
          supplierId: { not: null },
          date: { gte: prevStart, lte: prevEnd },
        },
        _sum: { amount: true },
        _count: true,
      }),
    ])

    if (groupedCurrent.length === 0) {
      return NextResponse.json({
        rows: [],
        totalAmount: 0,
        totalCount: 0,
        totalSuppliersUnique: 0,
        concentracaoTop5: 0,
        period: { from: input.from, to: input.to },
      })
    }

    const supplierIds = Array.from(
      new Set([
        ...groupedCurrent.map((g) => g.supplierId!),
        ...groupedPrev.map((g) => g.supplierId!),
      ]),
    )

    const suppliersRaw = await prisma.supplier.findMany({
      where: { id: { in: supplierIds }, companyId: empresaId },
      select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true },
    })

    const result = computeTopSuppliers({
      current: groupedCurrent
        .filter((g) => !!g.supplierId)
        .map((g) => ({
          supplierId: g.supplierId!,
          amount: g._sum.amount ?? 0,
          count: g._count,
        })),
      previous: groupedPrev
        .filter((g) => !!g.supplierId)
        .map((g) => ({
          supplierId: g.supplierId!,
          amount: g._sum.amount ?? 0,
          count: g._count,
        })),
      suppliers: suppliersRaw.map((s) => ({
        id: s.id,
        nome: s.nomeFantasia ?? s.razaoSocial,
        cnpj: s.cnpj,
      })),
      topN: input.topN,
    })

    return NextResponse.json({
      ...result,
      period: { from: input.from, to: input.to },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
