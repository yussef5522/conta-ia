// Sprint Export CSV+PDF (29/05/2026) — Endpoint export DRE.
// Reusa filtros + engine `calculateDRE` da route base. Adiciona `format=csv|pdf`.

import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { calculateDRE } from '@/lib/dre/calculator'
import { dreQuerySchema } from '@/lib/dre/validation'
import type {
  TransactionForDRE,
  CategoryForDRE,
  CalculateDREOptions,
  RegimeContabil,
} from '@/lib/dre/types'
import { renderDRECSV, renderDREPDF } from '@/lib/export/render/dre'
import { exportFilename } from '@/lib/export/csv/format'
import { z } from 'zod'

interface Params {
  params: Promise<{ id: string }>
}

export const runtime = 'nodejs'

const formatSchema = z.enum(['csv', 'pdf']).default('csv')

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

function formatPeriodoLabel(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  return `${fmt(start)} → ${fmt(end)}`
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('dre.view')

    const url = new URL(request.url)
    const rawQuery = Object.fromEntries(url.searchParams)
    const query = dreQuerySchema.parse(rawQuery)
    const format = formatSchema.parse(url.searchParams.get('format') ?? 'csv')

    const startDate = new Date(query.startDate)
    const endDate = new Date(query.endDate)
    const regime = query.regime as RegimeContabil
    const view = url.searchParams.get('view') === 'previsto' ? 'previsto' : 'realizado'
    const lifecycleFilter: { in: string[] } | string =
      view === 'previsto' ? { in: ['PAYABLE', 'RECEIVABLE'] } : 'EFFECTED'

    const empresa = await prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, tradeName: true },
    })
    const empresaNome = empresa?.tradeName ?? empresa?.name ?? 'Empresa'

    // Range de busca (reusa lógica do route base — sem comparison range
    // que adicionaria complexidade desnecessária no export)
    const searchRange = { start: startDate, end: endDate }

    const categoriesRaw = await prisma.category.findMany({
      where: { companyId },
      select: {
        id: true,
        name: true,
        code: true,
        dreGroup: true,
        parentId: true,
        isActive: true,
        type: true,
      },
    })
    const categories: CategoryForDRE[] = categoriesRaw.map((c) => ({
      id: c.id,
      name: c.name,
      code: c.code,
      dreGroup: c.dreGroup ?? '',
      parentId: c.parentId,
      isActive: c.isActive,
      type: c.type,
    }))

    const dateClauses =
      regime === 'competence'
        ? [
            { competenceDate: { gte: searchRange.start, lte: searchRange.end } },
            {
              competenceDate: null,
              date: { gte: searchRange.start, lte: searchRange.end },
            },
          ]
        : [{ paymentDate: { gte: searchRange.start, lte: searchRange.end } }]

    const tenantFilter =
      view === 'previsto'
        ? {
            OR: [
              { bankAccount: { companyId } },
              { supplier: { companyId } },
              { customer: { companyId } },
              { category: { companyId } },
            ],
          }
        : { bankAccount: { companyId } }

    const lifecycleDateClauses =
      view === 'previsto'
        ? [{ dueDate: { gte: searchRange.start, lte: searchRange.end } }]
        : dateClauses

    const transactionsRaw = await prisma.transaction.findMany({
      where: {
        ...tenantFilter,
        type: { not: 'TRANSFER' },
        lifecycle: lifecycleFilter,
        ...(view === 'realizado' ? { reconciledWithId: null } : {}),
        isInternalTransfer: false,
        OR: lifecycleDateClauses,
      },
      select: {
        id: true,
        type: true,
        amount: true,
        date: true,
        competenceDate: true,
        paymentDate: true,
        categoryId: true,
      },
    })

    const transactions: TransactionForDRE[] = transactionsRaw.map((t) => ({
      id: t.id,
      type: t.type as 'CREDIT' | 'DEBIT' | 'TRANSFER',
      amount: t.amount,
      date: t.date,
      competenceDate: t.competenceDate,
      paymentDate: t.paymentDate,
      categoryId: t.categoryId,
    }))

    const calcOptions: CalculateDREOptions = {
      period: { startDate, endDate, regime },
      comparison: { type: 'none' },
    }

    const result = calculateDRE(transactions, categories, calcOptions)

    if (format === 'csv') {
      const csv = renderDRECSV(result)
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${exportFilename('dre', empresaNome, 'csv')}"`,
          'X-Row-Count': String(result.groups.length),
        },
      })
    }

    const buf = await renderToBuffer(
      renderDREPDF(result, {
        empresaNome,
        regime,
        periodoLabel: formatPeriodoLabel(startDate, endDate),
        geradoEm: formatGeradoEmBR(new Date()),
      }),
    )
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${exportFilename('dre', empresaNome, 'pdf')}"`,
        'X-Row-Count': String(result.groups.length),
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
