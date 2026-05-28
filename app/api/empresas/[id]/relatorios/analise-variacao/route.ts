// Sprint Análise de Variação (28/05/2026) — GET.
//
// Decompõe a diferença entre 2 períodos (mês X vs mês Y OU vs média).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import {
  analiseVariacao,
  type AnaliseVariacaoInput,
} from '@/lib/relatorios/analise-variacao'
import type { ComparativoInputTx } from '@/lib/relatorios/comparativo'
import { parseRefMonth } from '@/lib/relatorios/comparativo'

const ymRegex = /^\d{4}-\d{2}$/

const baseSchema = z.object({
  mesInvestigado: z.string().regex(ymRegex, 'mesInvestigado deve ser YYYY-MM'),
  mode: z.enum(['mes-vs-mes', 'mes-vs-media']),
  tipo: z.enum(['DESPESA', 'RECEITA', 'TODOS']).default('DESPESA'),
  /** Regime: competência (default) | caixa */
  regime: z.enum(['competencia', 'caixa']).default('competencia'),
  topNDrivers: z.coerce.number().int().min(3).max(20).default(10),
})

const mesVsMesSchema = baseSchema.extend({
  mode: z.literal('mes-vs-mes'),
  ymComparacao: z.string().regex(ymRegex, 'ymComparacao deve ser YYYY-MM'),
})

const mesVsMediaSchema = baseSchema.extend({
  mode: z.literal('mes-vs-media'),
  nMesesContexto: z.coerce.number().int().min(2).max(12).default(6),
})

const querySchema = z.union([mesVsMesSchema, mesVsMediaSchema])

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
    const input = querySchema.parse(Object.fromEntries(sp.entries()))

    // Calcula o range SQL necessário
    // - mes-vs-mes: union(investigado, comparacao)
    // - mes-vs-media: investigado + (N-1) meses anteriores
    const investRange = parseRefMonth(input.mesInvestigado)
    let sqlRangeStart: Date
    let sqlRangeEnd: Date

    if (input.mode === 'mes-vs-mes') {
      const cmpRange = parseRefMonth(input.ymComparacao)
      sqlRangeStart =
        investRange.start < cmpRange.start ? investRange.start : cmpRange.start
      sqlRangeEnd =
        investRange.end > cmpRange.end ? investRange.end : cmpRange.end
    } else {
      // N meses contexto pra trás
      const N = input.nMesesContexto
      const earliestM = investRange.start.getUTCMonth() - (N - 1)
      const yAdj =
        investRange.start.getUTCFullYear() + Math.floor(earliestM / 12)
      const mNorm = ((earliestM % 12) + 12) % 12
      sqlRangeStart = new Date(Date.UTC(yAdj, mNorm, 1))
      sqlRangeEnd = investRange.end
    }

    // Where SQL padrão CORRIGIDO (competenceDate || fallback date) — mesmo do
    // comparativo após o bug-fix de 28/05/2026.
    const txs = await prisma.transaction.findMany({
      where: {
        AND: [
          {
            OR: [
              { bankAccount: { companyId: empresaId } },
              { supplier: { companyId: empresaId } },
              { employee: { companyId: empresaId } },
              { customer: { companyId: empresaId } },
              { category: { companyId: empresaId } },
            ],
          },
          {
            OR: [
              {
                competenceDate: { gte: sqlRangeStart, lte: sqlRangeEnd },
              },
              {
                competenceDate: null,
                date: { gte: sqlRangeStart, lte: sqlRangeEnd },
              },
            ],
          },
        ],
        status: { in: ['RECONCILED', 'PENDING'] },
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

    const inputTxs: ComparativoInputTx[] = txs.map((t) => ({
      bucketDate:
        input.regime === 'caixa'
          ? (t.paymentDate ?? t.date)
          : (t.competenceDate ?? t.date),
      amount: t.amount,
      type: t.type,
      categoryId: t.category?.id ?? null,
      categoryName: t.category?.name ?? null,
      dreGroup: t.category?.dreGroup ?? null,
    }))

    const analiseInput: AnaliseVariacaoInput =
      input.mode === 'mes-vs-mes'
        ? {
            mode: 'mes-vs-mes',
            txs: inputTxs,
            mesInvestigado: input.mesInvestigado,
            ymComparacao: input.ymComparacao,
            tipo: input.tipo,
            topNDrivers: input.topNDrivers,
          }
        : {
            mode: 'mes-vs-media',
            txs: inputTxs,
            mesInvestigado: input.mesInvestigado,
            nMesesContexto: input.nMesesContexto,
            tipo: input.tipo,
            topNDrivers: input.topNDrivers,
          }

    const result = analiseVariacao(analiseInput)
    return NextResponse.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
