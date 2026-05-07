// GET /api/empresas/[id]/dre/transactions — drill-down DRE (Sub-etapa 5.4.B).
//
// Lista transações de UMA categoria específica no período, paginado.
// Multi-tenant via bankAccount.companyId.
// Mesma lógica de filtragem por regime que o calculator (lib/dre/calculator.ts).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'

interface Params {
  params: Promise<{ id: string }>
}

const querySchema = z
  .object({
    categoryId: z.string().min(1, 'categoryId obrigatório'),
    startDate: z.string().datetime({ message: 'startDate inválido (ISO 8601)' }),
    endDate: z.string().datetime({ message: 'endDate inválido (ISO 8601)' }),
    regime: z.enum(['competence', 'cash']).default('competence'),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(200).default(50),
  })
  .superRefine((data, ctx) => {
    if (new Date(data.startDate).getTime() > new Date(data.endDate).getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endDate'],
        message: 'endDate deve ser posterior ou igual a startDate',
      })
    }
  })

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('dre.view')

    const url = new URL(request.url)
    const query = querySchema.parse(Object.fromEntries(url.searchParams))

    const startDate = new Date(query.startDate)
    const endDate = new Date(query.endDate)

    // Categoria precisa pertencer à empresa (multi-tenant)
    const category = await prisma.category.findFirst({
      where: { id: query.categoryId, companyId },
      select: { id: true, name: true, code: true, dreGroup: true },
    })

    if (!category) {
      return NextResponse.json(
        { erro: 'Categoria não encontrada' },
        { status: 404 },
      )
    }

    // Filtro por data conforme regime — espelha o calculator:
    //  - competência: competenceDate, fallback pra date se ausente
    //  - caixa: paymentDate (sem fallback)
    const dateClauses =
      query.regime === 'competence'
        ? [
            { competenceDate: { gte: startDate, lte: endDate } },
            {
              competenceDate: null,
              date: { gte: startDate, lte: endDate },
            },
          ]
        : [{ paymentDate: { gte: startDate, lte: endDate } }]

    const baseWhere = {
      bankAccount: { companyId },
      categoryId: query.categoryId,
      OR: dateClauses,
    }

    const orderField =
      query.regime === 'competence' ? 'competenceDate' : 'paymentDate'

    const [total, transactions] = await Promise.all([
      prisma.transaction.count({ where: baseWhere }),
      prisma.transaction.findMany({
        where: baseWhere,
        select: {
          id: true,
          type: true,
          amount: true,
          description: true,
          date: true,
          competenceDate: true,
          paymentDate: true,
          bankAccount: { select: { id: true, name: true } },
        },
        orderBy: [{ [orderField]: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ])

    return NextResponse.json({
      category: {
        id: category.id,
        name: category.name,
        code: category.code,
        dreGroup: category.dreGroup,
      },
      transactions: transactions.map((t) => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        description: t.description,
        date: t.date,
        competenceDate: t.competenceDate,
        paymentDate: t.paymentDate,
        bankAccount: t.bankAccount,
      })),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
