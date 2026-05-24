// GET /api/empresas/[id]/transacoes/export — Sprint 3.0.4 C1.
//
// Exporta transações da empresa em CSV. Aceita os MESMOS filtros do
// GET /api/transacoes: status, tipo, categoryId, q, valorMin/Max, inicio/fim,
// contaId, importId. Sem paginação — exporta tudo que bate o filtro (cap 10k).
//
// Padrão BOM UTF-8 + RFC 4180 igual ao audit log export.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { generateTransacoesCSV, transacoesCsvFilename } from '@/lib/transacoes/csv'

interface Params {
  params: Promise<{ id: string }>
}

const MAX_EXPORT = 10_000

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.view')

    const sp = request.nextUrl.searchParams
    const inicio = sp.get('inicio')
    const fim = sp.get('fim')
    const tipo = sp.get('tipo')
    const status = sp.get('status')
    const categoryId = sp.get('categoryId')
    const q = sp.get('q')?.trim() ?? null
    const importId = sp.get('importId')
    const contaId = sp.get('contaId')
    const valorMinStr = sp.get('valorMin')
    const valorMaxStr = sp.get('valorMax')
    const valorMin =
      valorMinStr && Number.isFinite(Number(valorMinStr)) && Number(valorMinStr) >= 0
        ? Number(valorMinStr)
        : null
    const valorMax =
      valorMaxStr && Number.isFinite(Number(valorMaxStr)) && Number(valorMaxStr) >= 0
        ? Number(valorMaxStr)
        : null

    // Pattern Record<string, unknown> espelha GET /api/transacoes (Prisma com
     // SQLite em dev ignora `mode: 'insensitive'`, Postgres em prod usa).
    const where: Record<string, unknown> = {
      bankAccount: contaId
        ? { id: contaId, companyId: empresaId }
        : { companyId: empresaId },
    }
    if (inicio || fim) {
      where.date = {
        ...(inicio ? { gte: new Date(inicio) } : {}),
        ...(fim ? { lte: new Date(fim + 'T23:59:59.999Z') } : {}),
      }
    }
    if (tipo) where.type = tipo
    if (status) where.status = status
    if (categoryId) where.categoryId = categoryId
    if (q) where.description = { contains: q, mode: 'insensitive' }
    if (importId) where.importId = importId
    if (valorMin !== null || valorMax !== null) {
      where.amount = {
        ...(valorMin !== null ? { gte: valorMin } : {}),
        ...(valorMax !== null ? { lte: valorMax } : {}),
      }
    }

    const [empresa, transacoes] = await Promise.all([
      prisma.company.findUnique({
        where: { id: empresaId },
        select: { name: true, tradeName: true },
      }),
      prisma.transaction.findMany({
        where,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: MAX_EXPORT,
        include: {
          category: { select: { name: true } },
          supplier: { select: { razaoSocial: true, nomeFantasia: true } },
          classifiedByRule: { select: { padrao: true } },
          bankAccount: {
            select: {
              name: true,
              bankName: true,
              company: { select: { name: true, tradeName: true } },
            },
          },
        },
      }),
    ])

    const csv = generateTransacoesCSV(transacoes)
    const fileName = transacoesCsvFilename(empresa?.tradeName ?? empresa?.name)

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
