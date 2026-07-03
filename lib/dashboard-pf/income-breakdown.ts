// Sprint Receitas-PF (02/07/2026).
//
// Breakdown de RECEITAS do perfil PF, irmã de expenses-breakdown.ts.
// Visão unificada de tudo que ENTROU no bolso:
//   - Retiradas do PJ (via PJtoPFBridge)
//   - Rendas externas (freelance, aluguel, salário CLT, etc)
//
// DIFERENCIAL CAIXAOS: cada tx que veio de retirada tem selo "↩ {empresa}
// · {data}" no drill-down. Nenhum líder (Monarch/Copilot/YNAB) etiqueta
// origem da renda por empresa.
//
// PADRÃO CACHE: NASCE SEM `unstable_cache` (lição Fix-Cache-Despesas
// 01/07/2026). Consulta direta a cada render, ~50ms.

import { prisma } from '@/lib/db'

// ============================================================
// Tipos
// ============================================================

export interface PersonalIncomeCategorySummary {
  categoryId: string | null // null = bucket "Sem categoria"
  name: string
  color: string | null
  icon: string | null
  total: number
  qtdTx: number
  pctDoTotal: number
  isTop: boolean
  variacaoPct: number | null
  /**
   * Semântica INVERTIDA em relação a despesas:
   *   subiu = mais renda que mês anterior (BOM, verde)
   *   caiu  = menos renda (RUIM, vermelho)
   *   nova  = categoria de renda que só apareceu neste mês (roxo)
   *   estavel = ±15%
   */
  tendencia: 'subiu' | 'caiu' | 'estavel' | 'nova'
}

export interface PersonalIncomeBreakdownResult {
  profileId: string
  periodStart: string
  periodEnd: string
  totalGeral: number
  totalTx: number
  totalCategorias: number
  categorias: PersonalIncomeCategorySummary[]
  computedAt: string
}

export interface PersonalIncomeTransactionItem {
  id: string
  date: string
  description: string
  amount: number
  bankAccountId: string | null
  bankAccountName: string | null
  categoryId: string | null
  categoryName: string | null
  categoryColor: string | null
  /**
   * Se ≠ null, esta receita veio de uma retirada do PJ (via ponte).
   * Puxa dados da empresa de origem pro selo no drill-down.
   */
  origem: {
    bridgeId: string
    kind: string
    empresaId: string
    empresaName: string
    pjDescription: string | null
    pjDate: string | null
  } | null
}

// ============================================================
// Inputs
// ============================================================

export interface GetPersonalIncomeBreakdownInput {
  profileId: string
  periodStart: Date
  periodEnd: Date
  bankAccountId?: string
  /** Filtro origem: só retiradas (bridge != null) ou só externas (bridge null). */
  originFilter?: 'bridge' | 'externa' | 'both'
}

export interface GetPersonalIncomeTransactionsInput
  extends GetPersonalIncomeBreakdownInput {
  categoryId?: string | null
  q?: string
  limit?: number
  offset?: number
}

// ============================================================
// Helper de where
// ============================================================

function buildBaseIncomeWhere(
  input: GetPersonalIncomeBreakdownInput,
) {
  const where: Record<string, unknown> = {
    profileId: input.profileId,
    type: 'CREDIT',
    // Receita NÃO tem isInvoicePayment — só aplica pra despesa (débito de fatura).
    date: { gte: input.periodStart, lt: input.periodEnd },
  }
  if (input.bankAccountId) where.bankAccountId = input.bankAccountId
  if (input.originFilter === 'bridge') {
    // Só retiradas: bridge relação não-null
    where.bridge = { isNot: null }
  } else if (input.originFilter === 'externa') {
    // Só rendas externas: sem bridge
    where.bridge = null
  }
  return where
}

// ============================================================
// Public API
// ============================================================

const VARIACAO_THRESHOLD = 0.15

/**
 * Breakdown de receitas por categoria (fonte de renda) + variação vs mês
 * anterior. SEM cache — consulta direta a cada chamada.
 */
export async function getPersonalIncomeBreakdown(
  input: GetPersonalIncomeBreakdownInput,
): Promise<PersonalIncomeBreakdownResult> {
  const whereCur = buildBaseIncomeWhere(input)

  const durMs = input.periodEnd.getTime() - input.periodStart.getTime()
  const prevStart = new Date(input.periodStart.getTime() - durMs)
  const prevEnd = new Date(input.periodStart.getTime())
  const wherePrev = { ...whereCur, date: { gte: prevStart, lt: prevEnd } }

  const [groupedCur, groupedPrev] = await Promise.all([
    prisma.personalTransaction.groupBy({
      by: ['categoryId'],
      where: whereCur,
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.personalTransaction.groupBy({
      by: ['categoryId'],
      where: wherePrev,
      _sum: { amount: true },
    }),
  ])

  const catIds = groupedCur
    .map((g) => g.categoryId)
    .filter((id): id is string => Boolean(id))
  const categories =
    catIds.length > 0
      ? await prisma.personalCategory.findMany({
          where: { id: { in: catIds } },
          select: { id: true, name: true, color: true, icon: true },
        })
      : []
  const catById = new Map(categories.map((c) => [c.id, c]))

  const prevByCatId = new Map<string | null, number>()
  for (const g of groupedPrev) {
    prevByCatId.set(g.categoryId, g._sum.amount ?? 0)
  }

  const totalGeral = groupedCur.reduce((s, g) => s + (g._sum.amount ?? 0), 0)
  const totalTx = groupedCur.reduce((s, g) => s + g._count._all, 0)

  const items: PersonalIncomeCategorySummary[] = groupedCur.map((g) => {
    const catMeta = g.categoryId ? catById.get(g.categoryId) : null
    const total = g._sum.amount ?? 0
    const prevTotal = prevByCatId.get(g.categoryId) ?? 0
    let variacaoPct: number | null = null
    let tendencia: PersonalIncomeCategorySummary['tendencia'] = 'estavel'
    if (prevTotal > 0) {
      variacaoPct = (total - prevTotal) / prevTotal
      if (variacaoPct > VARIACAO_THRESHOLD) tendencia = 'subiu'
      else if (variacaoPct < -VARIACAO_THRESHOLD) tendencia = 'caiu'
      else tendencia = 'estavel'
    } else if (total > 0) {
      tendencia = 'nova'
    }
    return {
      categoryId: g.categoryId,
      name: catMeta?.name ?? 'Sem categoria',
      color: catMeta?.color ?? null,
      icon: catMeta?.icon ?? null,
      total,
      qtdTx: g._count._all,
      pctDoTotal: totalGeral > 0 ? (total / totalGeral) * 100 : 0,
      isTop: false,
      variacaoPct,
      tendencia,
    }
  })

  items.sort((a, b) => b.total - a.total)
  if (items.length > 0) items[0].isTop = true

  return {
    profileId: input.profileId,
    periodStart: input.periodStart.toISOString(),
    periodEnd: input.periodEnd.toISOString(),
    totalGeral,
    totalTx,
    totalCategorias: items.length,
    categorias: items,
    computedAt: new Date().toISOString(),
  }
}

/**
 * Lista tx do drill-down por categoria. Include `bridge.pjTransaction.
 * bankAccount.company` pra montar o selo de origem ("↩ Cacula Mix · 08/06").
 */
export async function getPersonalIncomeTransactions(
  input: GetPersonalIncomeTransactionsInput,
): Promise<{ items: PersonalIncomeTransactionItem[]; total: number }> {
  const where = buildBaseIncomeWhere(input)
  if (input.categoryId === null) {
    where.categoryId = null
  } else if (input.categoryId) {
    where.categoryId = input.categoryId
  }
  if (input.q && input.q.trim().length > 0) {
    where.description = { contains: input.q.trim(), mode: 'insensitive' }
  }

  const [rows, total] = await Promise.all([
    prisma.personalTransaction.findMany({
      where,
      orderBy: { date: 'desc' },
      take: input.limit ?? 100,
      skip: input.offset ?? 0,
      include: {
        bankAccount: { select: { name: true } },
        category: { select: { name: true, color: true } },
        // Caminho: PersonalTransaction → bridge → pjTransaction → bankAccount → company
        bridge: {
          select: {
            id: true,
            kind: true,
            pjTransaction: {
              select: {
                description: true,
                date: true,
                bankAccount: {
                  select: {
                    company: {
                      select: {
                        id: true,
                        name: true,
                        tradeName: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.personalTransaction.count({ where }),
  ])

  const items: PersonalIncomeTransactionItem[] = rows.map((r) => {
    let origem: PersonalIncomeTransactionItem['origem'] = null
    if (r.bridge) {
      const empresa = r.bridge.pjTransaction?.bankAccount?.company
      origem = {
        bridgeId: r.bridge.id,
        kind: r.bridge.kind,
        empresaId: empresa?.id ?? '',
        empresaName: empresa?.tradeName ?? empresa?.name ?? 'Empresa',
        pjDescription: r.bridge.pjTransaction?.description ?? null,
        pjDate: r.bridge.pjTransaction?.date.toISOString() ?? null,
      }
    }
    return {
      id: r.id,
      date: r.date.toISOString(),
      description: r.description,
      amount: r.amount,
      bankAccountId: r.bankAccountId,
      bankAccountName: r.bankAccount?.name ?? null,
      categoryId: r.categoryId,
      categoryName: r.category?.name ?? null,
      categoryColor: r.category?.color ?? null,
      origem,
    }
  })

  return { items, total }
}
