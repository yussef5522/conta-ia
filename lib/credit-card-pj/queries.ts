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
  /** R4: soma da FATURA mais recente importada (era "mes corrente") */
  monthSpend: number
  monthTxCount: number
  utilizationPct: number
  /** R4: competencia da fatura usada nos totais acima (YYYY-MM ou null) */
  latestInvoiceMonth: string | null
}

/**
 * Sprint R4 — soma agora eh por FATURA (invoiceMonth) em vez de "mes corrente".
 * Pega a fatura mais recente de cada cartao (max invoiceMonth) e soma essa.
 * Se cartao nao tem nenhuma fatura importada -> 0.
 */
export async function listCardsForCompany(
  companyId: string,
): Promise<CardCardSummary[]> {
  const cards = await prisma.businessCreditCard.findMany({
    where: { companyId, isActive: true },
    orderBy: { name: 'asc' },
  })
  if (cards.length === 0) return []

  // Acha a competencia mais recente por cartao
  const latestInvoiceByCard = await prisma.transaction.groupBy({
    by: ['businessCreditCardId'],
    where: {
      businessCreditCardId: { in: cards.map((c) => c.id) },
      invoiceMonth: { not: null },
      isCardPayment: false,
    },
    _max: { invoiceMonth: true },
  })
  const latestByCardId = new Map(
    latestInvoiceByCard.map((r) => [
      r.businessCreditCardId as string,
      r._max.invoiceMonth,
    ]),
  )

  // Soma compras+encargos da fatura mais recente de cada cartao
  const totalsByCard = new Map<string, { sum: number; count: number; invoiceMonth: string }>()
  for (const cardId of cards.map((c) => c.id)) {
    const inv = latestByCardId.get(cardId)
    if (!inv) continue
    const agg = await prisma.transaction.aggregate({
      where: {
        businessCreditCardId: cardId,
        invoiceMonth: inv,
        isCardPayment: false,
        type: 'DEBIT',
      },
      _sum: { amount: true },
      _count: { _all: true },
    })
    totalsByCard.set(cardId, {
      sum: agg._sum.amount ?? 0,
      count: agg._count._all,
      invoiceMonth: inv,
    })
  }

  return cards.map((c) => {
    const t = totalsByCard.get(c.id) ?? { sum: 0, count: 0, invoiceMonth: null as string | null }
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
      latestInvoiceMonth: t.invoiceMonth,
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
  /**
   * Sprint R3 — pagamentos JA CASADOS com este cartao (isCardPayment=true +
   * businessCreditCardId=cardId). Janela 180 dias. Cada item tem desfazer.
   */
  matchedPayments: Array<{
    id: string
    date: string
    description: string
    amount: number
    bankAccountId: string | null
    bankAccountName: string | null
  }>
  /** R4: lista de competencias YYYY-MM disponiveis pra esse cartao (mais recente 1o) */
  availableInvoices: string[]
  /** R4: competencia ativa nesta view */
  currentInvoiceMonth: string | null
}

export async function getCardDashboard(
  companyId: string,
  cardId: string,
  /** R4: competencia YYYY-MM. Default = fatura mais recente */
  invoiceMonthFilter?: string | null,
): Promise<CardDashboardData | null> {
  const card = await prisma.businessCreditCard.findFirst({
    where: { id: cardId, companyId },
  })
  if (!card) return null

  // Reusa lista pro summary do header
  const list = await listCardsForCompany(companyId)
  const summary = list.find((c) => c.id === cardId)
  if (!summary) return null

  // R4: faturas disponiveis (DISTINCT invoiceMonth ordenadas desc)
  const invoicesAvail = await prisma.transaction.findMany({
    where: {
      businessCreditCardId: cardId,
      invoiceMonth: { not: null },
      isCardPayment: false,
    },
    distinct: ['invoiceMonth'],
    select: { invoiceMonth: true },
    orderBy: { invoiceMonth: 'desc' },
  })
  const availableInvoices = invoicesAvail
    .map((r) => r.invoiceMonth)
    .filter((m): m is string => !!m)

  // Competencia ativa: filtro do query string OU default (mais recente)
  const currentInvoiceMonth =
    invoiceMonthFilter && availableInvoices.includes(invoiceMonthFilter)
      ? invoiceMonthFilter
      : (availableInvoices[0] ?? null)

  // Tx da fatura ativa
  const txs = currentInvoiceMonth
    ? await prisma.transaction.findMany({
        where: {
          businessCreditCardId: cardId,
          invoiceMonth: currentInvoiceMonth,
        },
        orderBy: { date: 'desc' },
        take: 500,
        include: { category: { select: { name: true } } },
      })
    : []

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

  // Sprint R3 — pagamentos JA CASADOS com este cartao (180 dias)
  const since180 = new Date()
  since180.setDate(since180.getDate() - 180)
  const matchedPaymentsRaw = await prisma.transaction.findMany({
    where: {
      isCardPayment: true,
      businessCreditCardId: cardId,
      date: { gte: since180 },
    },
    select: {
      id: true,
      date: true,
      description: true,
      amount: true,
      bankAccountId: true,
      bankAccount: { select: { name: true } },
    },
    orderBy: { date: 'desc' },
    take: 24,
  })

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
    matchedPayments: matchedPaymentsRaw.map((p) => ({
      id: p.id,
      date: p.date.toISOString().slice(0, 10),
      description: p.description,
      amount: p.amount,
      bankAccountId: p.bankAccountId,
      bankAccountName: p.bankAccount?.name ?? null,
    })),
    availableInvoices,
    currentInvoiceMonth,
  }
}

/**
 * Sprint Cartao R4 (25/06/2026) — busca candidatos pra casar com fatura.
 *
 * VALOR EXATO eh CRITERIO SUFICIENTE (sem precisar de descricao de pagamento).
 * Caso real: "LIQUIDACAO BOLETO- 00360305000104 CARTOES" R$ 4.333,41 paga
 * a fatura Caixa via Sicredi — descricao nao tem PAGAMENTO/CARTAO/FATURA
 * mas o valor bate EXATO com totalToPay. Antes (R3) era exigido AMBOS
 * (descricao-regex AND valor proximo) e o pagamento sumia.
 *
 * Niveis de candidato:
 *   - EXATO (±R$0,02) com totalToPay OU totalDeclared       — sempre candidato
 *   - APROXIMADO (±R$1,00) + descricao parece pagamento     — candidato
 *   - APROXIMADO (±R$1,00) sem descricao parecida           — NAO candidato (anti-FP)
 *   - isCardPayment=true ja marcado pelo hook OFX           — sempre candidato
 *
 * Anti falso-positivo: valor APROXIMADO sozinho NAO basta — exige descricao
 * parecida. Valor EXATO sozinho basta (chance de coincidencia ao centavo eh
 * baixissima, e usuario sempre confirma no banner).
 */
export async function findCardPaymentCandidatesInBank(
  companyId: string,
  /**
   * Valor(es) alvo. Pode ser 1 (total declarado) ou 2 (total declarado +
   * total a pagar). Busca tx com valor proximo a QUALQUER um.
   */
  totalsFatura: number | number[],
  /** Tolerancia pra match APROXIMADO (com descricao). EXATO usa fixo ±0.02. */
  toleranceBRL: number = 1,
  daysBack: number = 120,
) {
  const since = new Date()
  since.setDate(since.getDate() - daysBack)

  const targets = Array.isArray(totalsFatura)
    ? totalsFatura.filter((n) => typeof n === 'number' && n > 0)
    : totalsFatura > 0
      ? [totalsFatura]
      : []

  const EXACT = 0.02
  const exactClauses = targets.map((t) => ({
    amount: { gte: t - EXACT, lte: t + EXACT },
  }))
  const approxClauses = targets.map((t) => ({
    amount: { gte: t - toleranceBRL, lte: t + toleranceBRL },
  }))

  // Regex AMPLIADO (R4): pega LIQUIDACAO, BOLETO, CARTOES plural, PGTO/PAGTO,
  // alem dos atuais PAGAMENTO/CARTAO/FATURA.
  const descKeywords = [
    'PAGAMENTO', 'pagamento',
    'PAGTO', 'pagto',
    'PGTO', 'pgto',
    'CARTAO', 'cartao', 'CARTÃO', 'cartão',
    'CARTOES', 'cartoes', 'CARTÕES', 'cartões',
    'FATURA', 'fatura',
    'LIQUIDACAO', 'liquidacao', 'LIQUIDAÇÃO', 'liquidação',
    'BOLETO', 'boleto',
  ]
  const descOr = descKeywords.map((kw) => ({
    description: { contains: kw },
  }))

  const orClauses: import('@prisma/client').Prisma.TransactionWhereInput[] = []

  if (exactClauses.length > 0) {
    // (a) Valor EXATO -> sempre candidato (descricao irrelevante)
    orClauses.push({
      isCardPayment: false,
      OR: exactClauses,
    })
    // (b) Valor APROXIMADO + descricao parece pagamento
    orClauses.push({
      isCardPayment: false,
      AND: [
        { OR: approxClauses },
        { OR: descOr },
      ],
    })
  }
  // (c) ja marcadas pelo hook OFX como pagamento aguardando casar
  orClauses.push({ isCardPayment: true })

  return prisma.transaction.findMany({
    where: {
      bankAccount: { companyId },
      type: 'DEBIT',
      businessCreditCardId: null,
      date: { gte: since },
      OR: orClauses,
    },
    include: {
      category: { select: { name: true } },
      bankAccount: { select: { name: true } },
    },
    orderBy: { date: 'desc' },
    take: 20,
  })
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
