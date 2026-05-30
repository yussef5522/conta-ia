// Sprint Export CSV+PDF (29/05/2026) — Endpoint de export do Comparativo.
//
// Reusa o mesmo query schema + lógica de fetch do GET base (/comparativo/route.ts).
// Suporta ?format=csv|pdf no mesmo querystring que a tela usa.
//
// CSV: Σ rows = total da tela (replicação exata).
// PDF: react-pdf renderToBuffer + PdfHeatmap.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import {
  computeComparativoMulti,
  buildPeriodos,
  type ComparativoInputTx,
  type Granularidade,
} from '@/lib/relatorios/comparativo'
import { renderComparativoCSV } from '@/lib/export/render/comparativo'
import { exportFilename } from '@/lib/export/csv/format'

const querySchema = z.object({
  refMonth: z.string().regex(/^\d{4}-\d{2}$/, 'refMonth deve ser YYYY-MM'),
  tipo: z.enum(['DESPESA', 'RECEITA', 'TODOS']).default('DESPESA'),
  regime: z.enum(['competencia', 'caixa']).default('competencia'),
  meses: z.coerce.number().int().min(2).max(12).default(3),
  granularidade: z.enum(['mes', 'trimestre', 'ano']).default('mes'),
  format: z.enum(['csv', 'pdf']).default('csv'),
})

interface Params {
  params: Promise<{ id: string }>
}

export const runtime = 'nodejs'

function formatGeradoEmBR(d: Date): string {
  return d.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('dre.view')

    const sp = request.nextUrl.searchParams
    const input = querySchema.parse(Object.fromEntries(sp.entries()))

    // Buscar nome da empresa pro header + filename (escopo multi-tenant via ctx)
    const empresa = await prisma.company.findUnique({
      where: { id: empresaId },
      select: { name: true, tradeName: true },
    })
    const empresaNome = empresa?.tradeName ?? empresa?.name ?? 'Empresa'

    // Calcular range SQL (mesma lógica do GET base)
    const periodos = buildPeriodos(
      input.refMonth,
      input.meses,
      input.granularidade as Granularidade,
    )
    const sqlRangeStart = periodos[0].start
    const sqlRangeEnd = periodos[periodos.length - 1].end

    // Mesmo filtro do endpoint base
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
        category: { select: { id: true, name: true, dreGroup: true } },
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

    const result = computeComparativoMulti(inputTxs, {
      ymRef: input.refMonth,
      nPeriodos: input.meses,
      granularidade: input.granularidade as Granularidade,
      tipo: input.tipo,
    })

    if (input.format === 'csv') {
      const csv = renderComparativoCSV(result)
      const filename = exportFilename(
        'comparativo',
        empresaNome,
        'csv',
      )
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'X-Row-Count': String(result.rows.length),
        },
      })
    }

    // PDF — dynamic imports pra contornar bundling issues do Next 16 com
    // @react-pdf/renderer (React error #31 quando bundled estaticamente).
    const geradoEm = formatGeradoEmBR(new Date())
    const [{ renderToBuffer }, { renderComparativoPDF }] = await Promise.all([
      import('@react-pdf/renderer'),
      import('@/lib/export/render/comparativo'),
    ])
    const pdfBuffer = await renderToBuffer(
      renderComparativoPDF(result, {
        empresaNome,
        tipo: input.tipo,
        regime: input.regime,
        granularidade: input.granularidade,
        geradoEm,
      }),
    )
    const filename = exportFilename('comparativo', empresaNome, 'pdf')
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Row-Count': String(result.rows.length),
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
