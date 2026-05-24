// GET /api/empresas/[id]/dre — DRE Gerencial (Sub-etapa 5.4.A).
//
// Query params (validados em lib/dre/validation.ts):
//   startDate (ISO 8601 obrigatório)
//   endDate (ISO 8601 obrigatório)
//   regime ('competence' | 'cash', default 'competence')
//   comparison ('none' | 'previous_period' | 'same_period_last_year' |
//               'previous_year' | 'ytd_vs_ytd' | 'custom', default 'none')
//   comparisonStartDate / comparisonEndDate (obrigatórios se comparison=custom)
//
// Retorna: DREResult conforme lib/dre/types.ts.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { calculateDRE } from '@/lib/dre/calculator'
import { dreQuerySchema } from '@/lib/dre/validation'
import type {
  TransactionForDRE,
  CategoryForDRE,
  ComparisonType,
  CalculateDREOptions,
  RegimeContabil,
} from '@/lib/dre/types'

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('dre.view')

    // Valida query params
    const url = new URL(request.url)
    const rawQuery = Object.fromEntries(url.searchParams)
    const query = dreQuerySchema.parse(rawQuery)

    const startDate = new Date(query.startDate)
    const endDate = new Date(query.endDate)
    const regime = query.regime as RegimeContabil

    // Sprint 4.0.1.b — view determina quais lifecycles entram no DRE.
    //   'realizado' (default): só EFFECTED (caixa real / fato gerador efetivado)
    //   'previsto': só PAYABLE/RECEIVABLE (compromissos pendentes)
    const view = url.searchParams.get('view') === 'previsto' ? 'previsto' : 'realizado'
    const lifecycleFilter: { in: string[] } | string =
      view === 'previsto'
        ? { in: ['PAYABLE', 'RECEIVABLE'] }
        : 'EFFECTED'

    // Range de busca: cobre período atual + comparação (engine pura filtra fino)
    const searchRange = computeSearchRange(query, startDate, endDate)

    // Categorias: TODAS da empresa (engine não pode pré-filtrar por isActive
    // porque transações antigas podem apontar pra categoria desativada).
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

    // Transações: multi-tenant via bankAccount.companyId (não há FK direta).
    // Range de query inclui transações cujo competenceDate (regime=competência)
    // OU paymentDate (regime=caixa) caia no range. Pra cobrir transações sem
    // competenceDate (legacy), também busca por `date` quando regime=competência.
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

    // Sprint 4.0.1.b — PAYABLE/RECEIVABLE não têm bankAccountId obrigatório
    // (criados sem conta definida). Pra view='previsto', resolvemos empresa via
    // OR de relações; pra 'realizado' mantemos bankAccount.companyId (mais rápido).
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

    // Para view='previsto', filtramos por dueDate (que é a data esperada)
    // em vez de competenceDate/paymentDate.
    const lifecycleDateClauses =
      view === 'previsto'
        ? [{ dueDate: { gte: searchRange.start, lte: searchRange.end } }]
        : dateClauses

    const transactionsRaw = await prisma.transaction.findMany({
      where: {
        ...tenantFilter,
        // Transferências entre contas da mesma empresa não compõem DRE (Sprint 0.5).
        // Filtragem no SQL evita trafegar dados que o engine descartaria.
        type: { not: 'TRANSFER' },
        // Sprint 4.0.1.a/b — REALIZADO = EFFECTED; PREVISTO = PAYABLE/RECEIVABLE.
        lifecycle: lifecycleFilter,
        // Sprint 4.0.2 — anti-dupla-contagem (só no Realizado).
        // No Previsto, todas PAYABLE/RECEIVABLE têm reconciledWithId=NULL por
        // definição (ainda pendentes), então o filtro é no-op mas seguro.
        ...(view === 'realizado' ? { reconciledWithId: null } : {}),
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
      comparison: buildComparisonOptions(query, regime),
    }

    const result = calculateDRE(transactions, categories, calcOptions)

    return NextResponse.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}

// ============================================================
// Helpers privados
// ============================================================

// Calcula o range de busca no banco. O engine filtra fino depois — aqui só
// queremos garantir que pegamos transações do período atual + comparison.
function computeSearchRange(
  query: ReturnType<typeof dreQuerySchema.parse>,
  startDate: Date,
  endDate: Date,
): { start: Date; end: Date } {
  let rangeStart = startDate
  let rangeEnd = endDate

  if (query.comparison === 'custom') {
    if (query.comparisonStartDate && query.comparisonEndDate) {
      const compStart = new Date(query.comparisonStartDate)
      const compEnd = new Date(query.comparisonEndDate)
      if (compStart.getTime() < rangeStart.getTime()) rangeStart = compStart
      if (compEnd.getTime() > rangeEnd.getTime()) rangeEnd = compEnd
    }
  } else if (query.comparison !== 'none') {
    // Aproximação segura: expande 2 anos pra trás (cobre previous_year,
    // previous_period anual, same_period_last_year, ytd_vs_ytd).
    const compStart = new Date(startDate)
    compStart.setFullYear(compStart.getFullYear() - 2)
    if (compStart.getTime() < rangeStart.getTime()) rangeStart = compStart
  }

  return { start: rangeStart, end: rangeEnd }
}

function buildComparisonOptions(
  query: ReturnType<typeof dreQuerySchema.parse>,
  regime: RegimeContabil,
): CalculateDREOptions['comparison'] {
  if (query.comparison === 'none') return undefined

  if (query.comparison === 'custom') {
    // Validation Zod já garante que ambas as datas existem quando custom
    if (!query.comparisonStartDate || !query.comparisonEndDate) {
      return { type: 'none' }
    }
    return {
      type: 'custom',
      period: {
        startDate: new Date(query.comparisonStartDate),
        endDate: new Date(query.comparisonEndDate),
        regime,
      },
    }
  }

  return { type: query.comparison as ComparisonType }
}
