// Sprint Comparativo-A (28/05/2026) — Endpoint multi-período.
//
// Retrocompat: defaults (meses=3, granularidade=mes) retornam o mesmo
// shape do antigo (rows/totals/meses) usando computeComparativo. Quando
// caller passa meses != 3 OU granularidade != 'mes', usamos
// computeComparativoMulti (shape novo).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import {
  computeComparativo,
  computeComparativoMulti,
  threeMonthsForRef,
  buildPeriodos,
  type ComparativoInputTx,
  type Granularidade,
} from '@/lib/relatorios/comparativo'

const querySchema = z.object({
  refMonth: z.string().regex(/^\d{4}-\d{2}$/, 'refMonth deve ser YYYY-MM'),
  tipo: z.enum(['DESPESA', 'RECEITA', 'TODOS']).default('DESPESA'),
  regime: z.enum(['competencia', 'caixa']).default('competencia'),
  // Sprint A: novos params (opcionais com defaults retrocompat)
  meses: z.coerce.number().int().min(2).max(12).default(3),
  granularidade: z.enum(['mes', 'trimestre', 'ano']).default('mes'),
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
    const input = querySchema.parse(Object.fromEntries(sp.entries()))

    // Range SQL: do início do PRIMEIRO período até o fim do ÚLTIMO.
    // Usa buildPeriodos pra cobrir mes/tri/ano uniformemente.
    const periodos = buildPeriodos(
      input.refMonth,
      input.meses,
      input.granularidade as Granularidade,
    )
    const sqlRangeStart = periodos[0].start
    const sqlRangeEnd = periodos[periodos.length - 1].end

    // Bug-fix 28/05/2026 (comparativo-bug-referencia): filtro por
    // competenceDate (com fallback `date` quando NULL) — não por `date` direto.
    // Antes: SQL filtrava t.date IN [range], mas bucket interno alocava por
    // competenceDate || date. Resultado: txs com competenceDate em mês X e
    // paymentDate (=date) em mês X+1 ficavam FORA do range quando X era o
    // último mês — causando bucket "ref" vazio. Veja
    // docs/sprints/comparativo-bug-referencia-audit.md.
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

    // Retrocompat: defaults antigos (3 meses, granularidade mês) → engine antigo
    const isLegacyShape = input.meses === 3 && input.granularidade === 'mes'

    if (isLegacyShape) {
      const result = computeComparativo(inputTxs, input.refMonth, input.tipo)
      // Anexa flag pra UI saber qual shape veio
      return NextResponse.json({ ...result, multi: false })
    }

    // Shape novo (Sprint A)
    const result = computeComparativoMulti(inputTxs, {
      ymRef: input.refMonth,
      nPeriodos: input.meses,
      granularidade: input.granularidade as Granularidade,
      tipo: input.tipo,
    })
    return NextResponse.json({ ...result, multi: true })
  } catch (error) {
    return handleApiError(error)
  }
}

// Suprime warning: threeMonthsForRef ainda exportado pela lib pra outras callers
void threeMonthsForRef
