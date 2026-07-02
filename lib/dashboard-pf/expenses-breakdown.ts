// Sprint Despesas-PF (02/07/2026).
//
// Breakdown de despesas do perfil PF nivelado com Monarch/Copilot + o
// diferencial CAIXAOS: marcador "veio de retirada PJ" via bridgeAsSpend.
//
// REGRA DE OURO anti-duplicação (confirmada no diagnóstico):
//   WHERE type='DEBIT' AND isInvoicePayment=false
// Isso pega: despesa de conta bancária + compra de cartão (todas as
// parcelas naquele mês). EXCLUI: pagamento de fatura (que é transferência,
// não despesa nova — a compra já foi contabilizada).
//
// PADRÃO CACHE: NASCE SEM `unstable_cache` (lição do Fix-Cache-Despesas
// 01/07/2026 — cache stale em Next 16 com revalidateTag). Consulta direta
// a cada render, ~50ms.

import { prisma } from '@/lib/db'

// ============================================================
// Tipos
// ============================================================

export interface PersonalExpenseCategorySummary {
  categoryId: string | null // null = bucket "Sem categoria"
  name: string
  color: string | null
  icon: string | null
  total: number
  qtdTx: number
  pctDoTotal: number
  /** Primeira do sort (maior total). Usado pra highlight visual. */
  isTop: boolean
  /** Variação vs mês anterior (0-1). null = mês anterior sem tx nessa cat. */
  variacaoPct: number | null
  /** Se variacaoPct > 0.15 é "subiu"; < -0.15 "caiu"; senão "estável". */
  tendencia: 'subiu' | 'caiu' | 'estavel' | 'nova'
}

export interface PersonalExpenseBreakdownResult {
  profileId: string
  periodStart: string // ISO
  periodEnd: string // ISO
  totalGeral: number
  totalTx: number
  totalCategorias: number
  categorias: PersonalExpenseCategorySummary[]
  computedAt: string
}

export interface PersonalExpenseTransactionItem {
  id: string
  date: string // ISO
  description: string
  amount: number
  bankAccountId: string | null
  bankAccountName: string | null
  creditCardId: string | null
  creditCardName: string | null
  categoryId: string | null
  categoryName: string | null
  categoryColor: string | null
  installmentNumber: number | null
  installmentTotal: number | null
  /** Se ≠ null, a tx é a "onde gastou" de uma retirada PJ. Preenchido pelo
   *  include em bridgeAsSpend. */
  bridgeSpend: {
    bridgeId: string
    kind: string
    pjDescription: string | null
    pjDate: string | null
  } | null
}

export interface PersonalCashFlowResult {
  periodStart: string
  periodEnd: string
  /** Total CREDIT no período (todas entradas). */
  entrou: number
  /** Total DEBIT sem pagamento fatura (todas despesas "de verdade"). */
  saiu: number
  /** entrou - saiu. */
  sobrou: number
  /** Parte de `entrou` que veio de ponte PJ→PF (retiradas). */
  entrou_bridge: number
  /** entrou - entrou_bridge (rendas próprias — freelance, etc). */
  entrou_outros: number
  /** Parte de `saiu` que é despesa vinculada a uma retirada (bridgeAsSpend). */
  saiu_bridge_spend: number
  qtdEntrou: number
  qtdSaiu: number
}

// ============================================================
// Inputs
// ============================================================

export interface GetPersonalExpenseBreakdownInput {
  profileId: string
  periodStart: Date
  periodEnd: Date
  /** Filtra por conta bancária específica. */
  bankAccountId?: string
  /** Filtra por cartão específico. */
  creditCardId?: string
  /** Filtra origem: só cartão, só conta bancária, ou ambos (default). */
  sourceFilter?: 'card' | 'account' | 'both'
  /** Só despesas que são "onde gastou uma retirada PJ" (bridgeAsSpend != null). */
  onlyBridgeSpend?: boolean
}

export interface GetPersonalExpenseTransactionsInput
  extends GetPersonalExpenseBreakdownInput {
  /** Filtra por categoria. null = bucket "Sem categoria". */
  categoryId?: string | null
  /** Busca livre em description (contains case-insensitive). */
  q?: string
  limit?: number
  offset?: number
}

export interface GetPersonalCashFlowInput {
  profileId: string
  periodStart: Date
  periodEnd: Date
}

// ============================================================
// Helpers de where
// ============================================================

function buildBaseExpenseWhere(
  input: GetPersonalExpenseBreakdownInput,
) {
  const where: Record<string, unknown> = {
    profileId: input.profileId,
    type: 'DEBIT',
    // Anti-duplicação: pagamento de fatura NÃO é despesa nova.
    isInvoicePayment: false,
    date: { gte: input.periodStart, lt: input.periodEnd },
  }
  if (input.bankAccountId) where.bankAccountId = input.bankAccountId
  if (input.creditCardId) where.creditCardId = input.creditCardId
  if (input.sourceFilter === 'card') {
    // Só cartão: creditCardId NOT NULL
    where.creditCardId = { not: null }
  } else if (input.sourceFilter === 'account') {
    // Só conta bancária: creditCardId NULL
    where.creditCardId = null
  }
  if (input.onlyBridgeSpend) {
    // Despesas ligadas a uma retirada via bridgeAsSpend
    where.bridgeAsSpend = { isNot: null }
  }
  return where
}

// ============================================================
// Public API
// ============================================================

const VARIACAO_THRESHOLD = 0.15

/**
 * Breakdown de despesas por categoria no período + variação vs mês anterior.
 * SEM cache — consulta direta a cada chamada.
 */
export async function getPersonalExpenseBreakdown(
  input: GetPersonalExpenseBreakdownInput,
): Promise<PersonalExpenseBreakdownResult> {
  const whereCur = buildBaseExpenseWhere(input)

  // Período do mês anterior (mesma duração)
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

  const items: PersonalExpenseCategorySummary[] = groupedCur.map((g) => {
    const catMeta = g.categoryId ? catById.get(g.categoryId) : null
    const total = g._sum.amount ?? 0
    const prevTotal = prevByCatId.get(g.categoryId) ?? 0
    let variacaoPct: number | null = null
    let tendencia: PersonalExpenseCategorySummary['tendencia'] = 'estavel'
    if (prevTotal > 0) {
      variacaoPct = (total - prevTotal) / prevTotal
      if (variacaoPct > VARIACAO_THRESHOLD) tendencia = 'subiu'
      else if (variacaoPct < -VARIACAO_THRESHOLD) tendencia = 'caiu'
      else tendencia = 'estavel'
    } else if (total > 0) {
      // Sem histórico anterior: categoria "nova" neste mês
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
 * Lista tx do drill-down por categoria. Include bridgeAsSpend pra marcar
 * as que "vieram de retirada PJ".
 */
export async function getPersonalExpenseTransactions(
  input: GetPersonalExpenseTransactionsInput,
): Promise<{ items: PersonalExpenseTransactionItem[]; total: number }> {
  const where = buildBaseExpenseWhere(input)
  // Filtro adicional por categoria (null = "Sem categoria")
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
        creditCard: { select: { name: true } },
        category: { select: { name: true, color: true } },
        bridgeAsSpend: {
          select: {
            id: true,
            kind: true,
            pjTransaction: { select: { description: true, date: true } },
          },
        },
      },
    }),
    prisma.personalTransaction.count({ where }),
  ])

  const items: PersonalExpenseTransactionItem[] = rows.map((r) => ({
    id: r.id,
    date: r.date.toISOString(),
    description: r.description,
    amount: r.amount,
    bankAccountId: r.bankAccountId,
    bankAccountName: r.bankAccount?.name ?? null,
    creditCardId: r.creditCardId,
    creditCardName: r.creditCard?.name ?? null,
    categoryId: r.categoryId,
    categoryName: r.category?.name ?? null,
    categoryColor: r.category?.color ?? null,
    installmentNumber: r.installmentNumber,
    installmentTotal: r.installmentTotal,
    bridgeSpend: r.bridgeAsSpend
      ? {
          bridgeId: r.bridgeAsSpend.id,
          kind: r.bridgeAsSpend.kind,
          pjDescription: r.bridgeAsSpend.pjTransaction?.description ?? null,
          pjDate: r.bridgeAsSpend.pjTransaction?.date.toISOString() ?? null,
        }
      : null,
  }))

  return { items, total }
}

/**
 * Card de fluxo (entrou/saiu/sobrou) + bônus: renda PJ (via ponte) vs
 * própria (outras rendas).
 */
export async function getPersonalCashFlow(
  input: GetPersonalCashFlowInput,
): Promise<PersonalCashFlowResult> {
  const baseDateFilter = {
    gte: input.periodStart,
    lt: input.periodEnd,
  }
  const [
    entrouAgg,
    saiuAgg,
    entrouBridgeAgg,
    saiuBridgeSpendAgg,
  ] = await Promise.all([
    // Total CREDIT (todas entradas)
    prisma.personalTransaction.aggregate({
      where: {
        profileId: input.profileId,
        type: 'CREDIT',
        date: baseDateFilter,
      },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    // Total DEBIT excluindo pagamento fatura (anti-duplicação)
    prisma.personalTransaction.aggregate({
      where: {
        profileId: input.profileId,
        type: 'DEBIT',
        isInvoicePayment: false,
        date: baseDateFilter,
      },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    // Entradas via ponte (bridge != null e é CREDIT)
    prisma.personalTransaction.aggregate({
      where: {
        profileId: input.profileId,
        type: 'CREDIT',
        date: baseDateFilter,
        bridge: { isNot: null },
      },
      _sum: { amount: true },
    }),
    // Despesas com vínculo bridgeAsSpend (retiradas gastas)
    prisma.personalTransaction.aggregate({
      where: {
        profileId: input.profileId,
        type: 'DEBIT',
        isInvoicePayment: false,
        date: baseDateFilter,
        bridgeAsSpend: { isNot: null },
      },
      _sum: { amount: true },
    }),
  ])

  const entrou = entrouAgg._sum.amount ?? 0
  const saiu = saiuAgg._sum.amount ?? 0
  const entrou_bridge = entrouBridgeAgg._sum.amount ?? 0
  const saiu_bridge_spend = saiuBridgeSpendAgg._sum.amount ?? 0

  return {
    periodStart: input.periodStart.toISOString(),
    periodEnd: input.periodEnd.toISOString(),
    entrou,
    saiu,
    sobrou: entrou - saiu,
    entrou_bridge,
    entrou_outros: entrou - entrou_bridge,
    saiu_bridge_spend,
    qtdEntrou: entrouAgg._count._all,
    qtdSaiu: saiuAgg._count._all,
  }
}
