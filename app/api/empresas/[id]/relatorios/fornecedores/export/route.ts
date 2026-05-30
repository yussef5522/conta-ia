// Sprint Export CSV+PDF (29/05/2026) — Endpoint export Fornecedores.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { renderToBuffer } from '@react-pdf/renderer'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { computeTopSuppliers } from '@/lib/relatorios/top-suppliers'
import { renderFornecedoresCSV, renderFornecedoresPDF } from '@/lib/export/render/fornecedores'
import { exportFilename } from '@/lib/export/csv/format'

export const runtime = 'nodejs'

const querySchema = z.object({
  from: z.string().date(),
  to: z.string().date(),
  topN: z.coerce.number().int().min(1).max(50).default(10),
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
      const empty = {
        rows: [], totalAmount: 0, totalCount: 0,
        totalSuppliersUnique: 0, concentracaoTop5: 0,
      }
      if (input.format === 'csv') {
        return new NextResponse(renderFornecedoresCSV(empty), {
          status: 200,
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${exportFilename('fornecedores', empresaNome, 'csv')}"`,
            'X-Row-Count': '0',
          },
        })
      }
      const buf = await renderToBuffer(
        renderFornecedoresPDF(empty, {
          empresaNome, from: input.from, to: input.to, geradoEm: formatGeradoEmBR(new Date()),
        }),
      )
      return new NextResponse(new Uint8Array(buf), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${exportFilename('fornecedores', empresaNome, 'pdf')}"`,
          'X-Row-Count': '0',
        },
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
        .map((g) => ({ supplierId: g.supplierId!, amount: g._sum.amount ?? 0, count: g._count })),
      previous: groupedPrev
        .filter((g) => !!g.supplierId)
        .map((g) => ({ supplierId: g.supplierId!, amount: g._sum.amount ?? 0, count: g._count })),
      suppliers: suppliersRaw.map((s) => ({
        id: s.id,
        nome: s.nomeFantasia ?? s.razaoSocial,
        cnpj: s.cnpj,
      })),
      topN: input.topN,
    })

    if (input.format === 'csv') {
      return new NextResponse(renderFornecedoresCSV(result), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${exportFilename('fornecedores', empresaNome, 'csv')}"`,
          'X-Row-Count': String(result.rows.length),
        },
      })
    }

    const buf = await renderToBuffer(
      renderFornecedoresPDF(result, {
        empresaNome, from: input.from, to: input.to, geradoEm: formatGeradoEmBR(new Date()),
      }),
    )
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${exportFilename('fornecedores', empresaNome, 'pdf')}"`,
        'X-Row-Count': String(result.rows.length),
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
