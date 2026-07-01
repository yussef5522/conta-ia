// Sprint 6 — Quebra completa de despesas (drill-down do Top 5).
//
// Reusa MESMOS filtros do motor único Sprint 4 (lib/dashboard/engine.ts):
//   - lifecycle = 'EFFECTED'
//   - reconciledWithId = null (anti-dupla-contagem)
//   - regime caixa (paymentDate fallback date) OU competência
//   - EXPENSE_DRE_GROUPS apenas (NON_DRE_GROUPS FORA: TRANSFERENCIA,
//     DISTRIBUICAO_LUCROS, INVESTIMENTOS, AJUSTE_SALDO)
//   - type = DEBIT (despesa)
//
// Garantia: SUM(categories.total) === despesaOperacional do motor ÚNICO,
// ao centavo (mesma fonte).
//
// O período é passado livre (não só "mês corrente"), então a página pode
// filtrar qualquer intervalo. Para "mês corrente", chamador passa periods
// derivePeriods(refDate).currentMonth.

// Sprint Fix-Cache-Despesas (01/07/2026): removido `unstable_cache` de
// `getExpenseBreakdown`. Antes o cabeçalho de cada categoria (`21 tx ·
// R$41.968,75`) ficava travado 60s após recategorizar — `revalidateTag`
// no route.ts recategorizar não invalidava no Next 16 em runtime prod.
// Resultado: user via total STALE mesmo após reload (a lista já mostrava
// atualizada porque não tinha cache). Fix: 1 query groupBy por render,
// ~50-150ms, cabeçalho sempre real-time.
import { prisma } from '@/lib/db'
import { NON_DRE_GROUP_SET } from '@/lib/dre/types'
import type { Regime } from './engine'

const EXPENSE_DRE_GROUPS = new Set([
  'CUSTO_PRODUTO_VENDIDO',
  'DESPESAS_PESSOAL',
  'DESPESAS_COMERCIAIS',
  'DESPESAS_ADMINISTRATIVAS',
  'DESPESAS_FINANCEIRAS',
  'OUTRAS_DESPESAS',
  'IMPOSTOS_SOBRE_LUCRO',
])

export interface ExpenseCategorySummary {
  categoryId: string
  name: string
  dreGroup: string
  total: number
  qtdTx: number
  pctDoTotal: number
  /** Maior gasto = primeira; usado pra renderizar barra visual */
  isTop: boolean
}

export interface ExpenseBreakdownResult {
  companyId: string
  regime: Regime
  periodStart: string // ISO
  periodEnd: string // ISO
  totalGeral: number
  totalTx: number
  totalCategorias: number
  categorias: ExpenseCategorySummary[]
  /** dreGroup → soma total (pra agrupamento visual futuro) */
  porGrupo: Array<{ dreGroup: string; total: number; qtdTx: number }>
  computedAt: string
}

export interface ExpenseTransactionItem {
  id: string
  date: string // ISO yyyy-mm-dd
  description: string
  amount: number
  bankAccountName: string | null
  supplierName: string | null
  categoryId: string
  categoryName: string
  dreGroup: string
}

interface GetExpenseBreakdownInput {
  companyId: string
  periodStart: Date
  periodEnd: Date
  regime: Regime
}

interface GetExpenseTransactionsInput extends GetExpenseBreakdownInput {
  categoryId?: string
  bankAccountId?: string
  /** busca livre na description (LIKE %q%) */
  q?: string
  limit?: number
  offset?: number
}

export async function getExpenseBreakdown(
  input: GetExpenseBreakdownInput,
): Promise<ExpenseBreakdownResult> {
  if (!input.companyId) throw new Error('companyId obrigatório (multi-tenant)')
  // Sprint Fix-Cache-Despesas (01/07/2026): consulta direta, SEM
  // unstable_cache. Antes tinha TTL 60s + tag `dashboard:${companyId}`
  // mas `revalidateTag` do route.ts recategorizar não invalidava no
  // Next 16 (comportamento imprevisível de `unstable_cache` em route
  // handlers). Total STALE após recategorizar. Custo agora: 1 groupBy
  // Prisma por render, ~50-150ms — imperceptível. Cabeçalho SEMPRE
  // bate com a lista (que também é real-time). Elimina toda a classe
  // "recategorizei mas o total não atualizou".
  return loadExpenseBreakdown(input)
}

export async function getExpenseTransactions(
  input: GetExpenseTransactionsInput,
): Promise<{ items: ExpenseTransactionItem[]; total: number }> {
  if (!input.companyId) throw new Error('companyId obrigatório (multi-tenant)')
  // sem cache aqui — filtros + paginação variam muito; tabela de tx muda
  // a cada classificação, conviria cache curto. MVP: sem cache.
  return loadExpenseTransactions(input)
}

// ============================================================
// Implementação
// ============================================================

function buildWhereExpenseEffected(
  companyId: string,
  periodStart: Date,
  periodEnd: Date,
  regime: Regime,
) {
  // Filtro de data: caixa = paymentDate (fallback date); competência = competenceDate.
  // Mesmo padrão do whereByRegime do engine, mas adaptado pro período
  // arbitrário (não só currentMonth+previousMonth).
  const dateFilter =
    regime === 'caixa'
      ? {
          OR: [
            { paymentDate: { gte: periodStart, lte: periodEnd } },
            {
              paymentDate: null,
              date: { gte: periodStart, lte: periodEnd },
            },
          ],
        }
      : {
          OR: [
            { competenceDate: { gte: periodStart, lte: periodEnd } },
            {
              competenceDate: null,
              date: { gte: periodStart, lte: periodEnd },
            },
          ],
        }

  return {
    bankAccount: { companyId },
    lifecycle: 'EFFECTED',
    reconciledWithId: null,
    type: 'DEBIT', // só DEBIT (despesa)
    categoryId: { not: null },
    category: {
      dreGroup: { in: Array.from(EXPENSE_DRE_GROUPS) },
    },
    ...dateFilter,
  } as const
}

/** Exposto pra scripts CLI / testes. Em runtime do app use getExpenseBreakdown (com cache). */
export async function loadExpenseBreakdown(
  input: GetExpenseBreakdownInput,
): Promise<ExpenseBreakdownResult> {
  const { companyId, periodStart, periodEnd, regime } = input

  // groupBy de tx EFFECTED DEBIT em EXPENSE_DRE_GROUPS no período.
  const grouped = await prisma.transaction.groupBy({
    by: ['categoryId'],
    where: buildWhereExpenseEffected(companyId, periodStart, periodEnd, regime),
    _sum: { amount: true },
    _count: { _all: true },
  })

  const categoryIds = grouped
    .map((g) => g.categoryId)
    .filter((id): id is string => Boolean(id))

  const categories = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true, dreGroup: true },
  })
  const catById = new Map(categories.map((c) => [c.id, c]))

  // Defensive double-guard: filtra NON_DRE caso categoria mude depois.
  const flat = grouped
    .map((g) => {
      const cat = catById.get(g.categoryId!)
      if (!cat || !cat.dreGroup) return null
      if (NON_DRE_GROUP_SET.has(cat.dreGroup)) return null
      if (!EXPENSE_DRE_GROUPS.has(cat.dreGroup)) return null
      const total = Math.abs(g._sum.amount ?? 0)
      const qtdTx = g._count._all
      return {
        categoryId: cat.id,
        name: cat.name,
        dreGroup: cat.dreGroup,
        total,
        qtdTx,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.total - a.total)

  const totalGeral = flat.reduce((s, c) => s + c.total, 0)
  const totalTx = flat.reduce((s, c) => s + c.qtdTx, 0)

  const categorias: ExpenseCategorySummary[] = flat.map((c, idx) => ({
    ...c,
    pctDoTotal: totalGeral > 0 ? (c.total / totalGeral) * 100 : 0,
    isTop: idx === 0,
  }))

  // Por dreGroup (pra agrupamento futuro)
  const grupoMap = new Map<string, { total: number; qtdTx: number }>()
  for (const c of flat) {
    const prev = grupoMap.get(c.dreGroup) ?? { total: 0, qtdTx: 0 }
    grupoMap.set(c.dreGroup, { total: prev.total + c.total, qtdTx: prev.qtdTx + c.qtdTx })
  }
  const porGrupo = Array.from(grupoMap.entries())
    .map(([dreGroup, v]) => ({ dreGroup, ...v }))
    .sort((a, b) => b.total - a.total)

  return {
    companyId,
    regime,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    totalGeral,
    totalTx,
    totalCategorias: categorias.length,
    categorias,
    porGrupo,
    computedAt: new Date().toISOString(),
  }
}

async function loadExpenseTransactions(
  input: GetExpenseTransactionsInput,
): Promise<{ items: ExpenseTransactionItem[]; total: number }> {
  const { companyId, periodStart, periodEnd, regime, categoryId, bankAccountId, q, limit = 100, offset = 0 } = input

  const where = {
    ...buildWhereExpenseEffected(companyId, periodStart, periodEnd, regime),
    ...(categoryId ? { categoryId } : {}),
    ...(bankAccountId
      ? { bankAccount: { companyId, id: bankAccountId } }
      : {}),
    ...(q && q.trim()
      ? { description: { contains: q.trim(), mode: 'insensitive' as const } }
      : {}),
  }

  const [items, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: [{ date: 'desc' }, { amount: 'desc' }],
      take: Math.min(limit, 500),
      skip: offset,
      select: {
        id: true,
        date: true,
        description: true,
        amount: true,
        categoryId: true,
        bankAccount: { select: { name: true } },
        supplier: { select: { razaoSocial: true } },
        category: { select: { name: true, dreGroup: true } },
      },
    }),
    prisma.transaction.count({ where }),
  ])

  return {
    items: items.map((t) => ({
      id: t.id,
      date: t.date.toISOString().slice(0, 10),
      description: t.description,
      amount: t.amount,
      bankAccountName: t.bankAccount?.name ?? null,
      supplierName: t.supplier?.razaoSocial ?? null,
      categoryId: t.categoryId ?? '',
      categoryName: t.category?.name ?? '—',
      dreGroup: t.category?.dreGroup ?? '',
    })),
    total,
  }
}
