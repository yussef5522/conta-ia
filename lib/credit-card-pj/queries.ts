// Sprint Cartao Credito PJ (24/06/2026) — queries de cartao + agregados pra dashboard.

import { prisma } from '@/lib/db'

export interface CardCardSummary {
  id: string
  name: string
  bankName: string | null
  brand: string | null
  lastDigits: string | null
  creditLimit: number
  closingDay: number
  dueDay: number
  closingDayRule: string
  defaultPaymentBankAccountId: string | null
  isActive: boolean
  /** Soma das compras + encargos do MES corrente (R$) */
  monthSpend: number
  /** Quantidade de tx do mes corrente */
  monthTxCount: number
  /** Limite usado / limite total (0-1, clamp ate 1.0 visual) */
  utilizationPct: number
}

export async function listCardsForCompany(
  companyId: string,
): Promise<CardCardSummary[]> {
  const cards = await prisma.businessCreditCard.findMany({
    where: { companyId, isActive: true },
    orderBy: { name: 'asc' },
  })
  if (cards.length === 0) return []

  // Soma compras+encargos do mes corrente por cartao
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const monthTotals = await prisma.transaction.groupBy({
    by: ['businessCreditCardId'],
    where: {
      businessCreditCardId: { in: cards.map((c) => c.id) },
      isCardPayment: false,
      type: 'DEBIT',
      date: { gte: startOfMonth, lte: now },
    },
    _sum: { amount: true },
    _count: { _all: true },
  })

  const totalsByCard = new Map(
    monthTotals.map((t) => [
      t.businessCreditCardId as string,
      { sum: t._sum.amount ?? 0, count: t._count._all },
    ]),
  )

  return cards.map((c) => {
    const t = totalsByCard.get(c.id) ?? { sum: 0, count: 0 }
    return {
      id: c.id,
      name: c.name,
      bankName: c.bankName,
      brand: c.brand,
      lastDigits: c.lastDigits,
      creditLimit: c.creditLimit,
      closingDay: c.closingDay,
      dueDay: c.dueDay,
      closingDayRule: c.closingDayRule,
      defaultPaymentBankAccountId: c.defaultPaymentBankAccountId,
      isActive: c.isActive,
      monthSpend: round2(t.sum),
      monthTxCount: t.count,
      utilizationPct: c.creditLimit > 0 ? Math.min(1, t.sum / c.creditLimit) : 0,
    }
  })
}

export interface CardDashboardData {
  card: CardCardSummary
  /** Transacoes do mes corrente, mais recentes primeiro */
  monthTransactions: Array<{
    id: string
    date: string
    description: string
    amount: number
    type: string
    installmentNumber: number | null
    installmentTotal: number | null
    categoryName: string | null
    isCardPayment: boolean
  }>
  /** Gasto por categoria (Top N) no mes corrente */
  spendByCategory: Array<{
    categoryId: string | null
    categoryName: string
    amount: number
  }>
}

export async function getCardDashboard(
  companyId: string,
  cardId: string,
): Promise<CardDashboardData | null> {
  const card = await prisma.businessCreditCard.findFirst({
    where: { id: cardId, companyId },
  })
  if (!card) return null

  // Reusa lista pro summary do header
  const list = await listCardsForCompany(companyId)
  const summary = list.find((c) => c.id === cardId)
  if (!summary) return null

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const txs = await prisma.transaction.findMany({
    where: {
      businessCreditCardId: cardId,
      date: { gte: startOfMonth, lte: now },
    },
    orderBy: { date: 'desc' },
    take: 200,
    include: {
      category: { select: { name: true } },
    },
  })

  // Por categoria
  const byCat = new Map<string, { categoryId: string | null; name: string; amount: number }>()
  for (const t of txs) {
    if (t.isCardPayment) continue
    const key = t.categoryId ?? 'sem-categoria'
    const name = t.category?.name ?? 'Sem categoria'
    const cur = byCat.get(key) ?? { categoryId: t.categoryId, name, amount: 0 }
    cur.amount += t.amount
    byCat.set(key, cur)
  }
  const spendByCategory = Array.from(byCat.values())
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10)
    .map((c) => ({
      categoryId: c.categoryId,
      categoryName: c.name,
      amount: round2(c.amount),
    }))

  return {
    card: summary,
    monthTransactions: txs.map((t) => ({
      id: t.id,
      date: t.date.toISOString().slice(0, 10),
      description: t.description,
      amount: t.amount,
      type: t.type,
      installmentNumber: t.installmentNumber,
      installmentTotal: t.installmentTotal,
      categoryName: t.category?.name ?? null,
      isCardPayment: t.isCardPayment,
    })),
    spendByCategory,
  }
}

/**
 * Sprint Cartao R2 (24/06/2026) — busca candidatos pra casar com fatura.
 *
 * Inclui:
 *   (a) tx classificadas como despesa por engano (isCardPayment=false) +
 *       descricao tipo PAGAMENTO/CARTAO/FATURA + valor proximo. Caso real
 *       R$ 2.654,63 Banrisul.
 *   (b) tx ja marcadas como pagamento de cartao mas SEM cardId
 *       (isCardPayment=true, businessCreditCardId=null = aguardando casar),
 *       independente do valor. Essas vem do hook do import OFX.
 *
 * Resultado ordenado por data desc. Janela 120 dias.
 */
export async function findCardPaymentCandidatesInBank(
  companyId: string,
  totalFatura: number,
  /** Valor sugerido vir da fatura — busca proximo */
  toleranceBRL: number = 1,
  daysBack: number = 120,
) {
  const since = new Date()
  since.setDate(since.getDate() - daysBack)

  return prisma.transaction.findMany({
    where: {
      bankAccount: { companyId },
      type: 'DEBIT',
      businessCreditCardId: null,
      date: { gte: since },
      OR: [
        // (a) descrição parece pagamento E valor proximo (caso R$ 2.654,63)
        {
          isCardPayment: false,
          amount: { gte: totalFatura - toleranceBRL, lte: totalFatura + toleranceBRL },
          OR: [
            { description: { contains: 'PAGAMENTO' } },
            { description: { contains: 'pagamento' } },
            { description: { contains: 'CARTAO' } },
            { description: { contains: 'cartao' } },
            { description: { contains: 'CARTÃO' } },
            { description: { contains: 'cartão' } },
            { description: { contains: 'FATURA' } },
            { description: { contains: 'fatura' } },
          ],
        },
        // (b) ja marcadas pelo hook OFX como pagamento, aguardando casar
        // (qualquer valor — geralmente faz match pelo total da fatura tambem)
        { isCardPayment: true },
      ],
    },
    include: {
      category: { select: { name: true } },
      bankAccount: { select: { name: true } },
    },
    orderBy: { date: 'desc' },
    take: 15,
  })
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
