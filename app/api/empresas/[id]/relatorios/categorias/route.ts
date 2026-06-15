// Sprint 5.0.4.0a (a3) — GET Análise por Categoria (Top N).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import {
  computeTopCategorias,
  type CategoriaInputTx,
} from '@/lib/relatorios/categorias'

const querySchema = z.object({
  from: z.string().date(),
  to: z.string().date(),
  tipo: z.enum(['DESPESA', 'RECEITA', 'TODOS']).default('DESPESA'),
  topN: z.coerce.number().int().min(1).max(50).default(10),
  regime: z.enum(['competencia', 'caixa']).default('competencia'),
})

interface Params {
  params: Promise<{ id: string }>
}

export const runtime = 'nodejs'

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('dre.view')

    const sp = request.nextUrl.searchParams
    // Sprint Filtro de Data Parte B: aceita ?inicio=&fim= como alias de from/to
    const raw = Object.fromEntries(sp.entries())
    if (!raw.from && raw.inicio) raw.from = raw.inicio as string
    if (!raw.to && raw.fim) raw.to = raw.fim as string
    const input = querySchema.parse(raw)

    const start = new Date(`${input.from}T00:00:00.000Z`)
    const end = new Date(`${input.to}T23:59:59.999Z`)

    const txs = await prisma.transaction.findMany({
      where: {
        OR: [
          { bankAccount: { companyId: empresaId } },
          { supplier: { companyId: empresaId } },
          { employee: { companyId: empresaId } },
          { customer: { companyId: empresaId } },
          { category: { companyId: empresaId } },
        ],
        status: { in: ['RECONCILED', 'PENDING'] },
        date: { gte: start, lte: end },
      },
      select: {
        amount: true,
        type: true,
        date: true,
        competenceDate: true,
        paymentDate: true,
        categoryId: true,
        category: {
          select: { id: true, name: true, dreGroup: true },
        },
      },
      take: 50_000,
    })

    const inputTxs: CategoriaInputTx[] = txs.map((t) => ({
      date:
        input.regime === 'caixa'
          ? (t.paymentDate ?? t.date)
          : (t.competenceDate ?? t.date),
      amount: t.amount,
      type: t.type,
      categoryId: t.category?.id ?? null,
      categoryName: t.category?.name ?? null,
      dreGroup: t.category?.dreGroup ?? null,
    }))

    const result = computeTopCategorias({
      txs: inputTxs,
      start,
      end,
      tipo: input.tipo,
      topN: input.topN,
    })

    return NextResponse.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
