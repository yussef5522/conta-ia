// Sprint 5.0.3.0b — Export CSV PT-BR de /contas-a-pagar.
//
// GET com mesmos query params da página + opcional `transactionIds` (csv)
// pra exportar APENAS as selecionadas (bulk action "Exportar selecionadas").
//
// Encoding: UTF-8 BOM + ; + CRLF — compatível com Excel BR.
// Filename: contas-pagar-{empresaSlug}-{YYYY-MM-DD}.csv

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import {
  buildPayableListWhere,
  buildPayableOrderBy,
  listPayableSchema,
} from '@/lib/contas-pagar/list-filters'
import {
  buildPayableCSV,
  buildCSVFilename,
  type ExportRow,
} from '@/lib/contas-pagar/csv-export'

interface Params {
  params: Promise<{ id: string }>
}

export const runtime = 'nodejs'
export const maxDuration = 60

// Limite de linhas pra não estourar memória/timeout em export
const EXPORT_MAX_ROWS = 10_000

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId } = await params
    const sp = request.nextUrl.searchParams

    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.view')

    // Carrega nome da empresa pro filename (slug)
    const empresa = await prisma.company.findUnique({
      where: { id: empresaId },
      select: { name: true, tradeName: true },
    })
    if (!empresa) {
      return NextResponse.json(
        { erro: 'Empresa não encontrada', code: 'EMPRESA_NOT_FOUND' },
        { status: 404 },
      )
    }
    const empresaLabel = empresa.tradeName ?? empresa.name

    // Parse filtros como na lista — escopo idêntico ao da página
    const input = listPayableSchema.parse({
      ...Object.fromEntries(sp.entries()),
      empresaId,
      // Sobrescreve limit pra cap de export
      limit: EXPORT_MAX_ROWS,
      page: 1,
    })

    const where = buildPayableListWhere(input, new Date())
    const orderBy = buildPayableOrderBy(input)

    // transactionIds parameter: bulk export
    const explicitIds = sp.get('transactionIds')?.split(',').filter(Boolean) ?? []
    if (explicitIds.length > 0) {
      // Sobrescreve filtros — pega só estas IDs (mas mantém multi-tenant via where.OR)
      ;(where as Record<string, unknown>).id = { in: explicitIds }
    }

    const rows = await prisma.transaction.findMany({
      where,
      orderBy,
      take: EXPORT_MAX_ROWS,
      include: {
        category: {
          select: { id: true, name: true, color: true, dreGroup: true },
        },
        supplier: {
          select: { id: true, razaoSocial: true, nomeFantasia: true },
        },
        employee: { select: { id: true, nome: true } },
        bankAccount: {
          select: { id: true, name: true, bankName: true },
        },
      },
    })

    // Adapt Prisma row → ExportRow (datas viram ISO string pra CSV lib)
    const exportRows: ExportRow[] = rows.map((r) => ({
      id: r.id,
      description: r.description,
      amount: r.amount,
      dueDate: r.dueDate?.toISOString() ?? null,
      paymentDate: r.paymentDate?.toISOString() ?? null,
      status: r.status,
      notes: r.notes,
      category: r.category
        ? {
            id: r.category.id,
            name: r.category.name,
            color: r.category.color,
            dreGroup: r.category.dreGroup,
          }
        : null,
      supplier: r.supplier
        ? {
            id: r.supplier.id,
            razaoSocial: r.supplier.razaoSocial,
            nomeFantasia: r.supplier.nomeFantasia,
          }
        : null,
      employee: r.employee
        ? { id: r.employee.id, nome: r.employee.nome }
        : null,
      bankAccount: r.bankAccount
        ? {
            id: r.bankAccount.id,
            name: r.bankAccount.name,
            bankName: r.bankAccount.bankName,
          }
        : null,
      // favorecidoType: requires Supplier.notes parsing OR Employee.tipo —
      // por simplicidade nesta sprint deixamos null (UI mostra '' no CSV)
      favorecidoType: r.employee ? 'EMPLOYEE' : r.supplier ? 'SUPPLIER' : null,
    }))

    const csv = buildPayableCSV(exportRows)
    const filename = buildCSVFilename(empresaLabel, new Date())

    console.log(
      `[CSV-EXPORT] empresa=${empresaId} rows=${exportRows.length} filename="${filename}"`,
    )

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Row-Count': String(exportRows.length),
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
