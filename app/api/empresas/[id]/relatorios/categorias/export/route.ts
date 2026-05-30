// Sprint Export CSV+PDF (29/05/2026) — Endpoint export Categorias.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { computeTopCategorias, type CategoriaInputTx } from '@/lib/relatorios/categorias'
import { renderCategoriasCSV } from '@/lib/export/render/categorias'
import { exportFilename } from '@/lib/export/csv/format'
import { renderPdfInWorker } from '@/lib/export/pdf-worker-client'

export const runtime = 'nodejs'

const querySchema = z.object({
  from: z.string().date(),
  to: z.string().date(),
  tipo: z.enum(['DESPESA', 'RECEITA', 'TODOS']).default('DESPESA'),
  topN: z.coerce.number().int().min(1).max(50).default(10),
  regime: z.enum(['competencia', 'caixa']).default('competencia'),
  format: z.enum(['csv', 'pdf']).default('csv'),
})

interface Params {
  params: Promise<{ id: string }>
}

function formatGeradoEmBR(d: Date): string {
  return d.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('dre.view')

    const sp = request.nextUrl.searchParams
    const input = querySchema.parse(Object.fromEntries(sp.entries()))

    const empresa = await prisma.company.findUnique({
      where: { id: empresaId },
      select: { name: true, tradeName: true },
    })
    const empresaNome = empresa?.tradeName ?? empresa?.name ?? 'Empresa'

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
        category: { select: { id: true, name: true, dreGroup: true } },
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

    if (input.format === 'csv') {
      const csv = renderCategoriasCSV(result)
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${exportFilename('categorias', empresaNome, 'csv')}"`,
          'X-Row-Count': String(result.rows.length),
        },
      })
    }

    // Hotfix worker (29/05/2026): PDF via processo isolado
    const buf = await renderPdfInWorker('categorias', result, {
      empresaNome,
      tipo: input.tipo,
      regime: input.regime,
      from: input.from,
      to: input.to,
      geradoEm: formatGeradoEmBR(new Date()),
    })
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${exportFilename('categorias', empresaNome, 'pdf')}"`,
        'X-Row-Count': String(result.rows.length),
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
