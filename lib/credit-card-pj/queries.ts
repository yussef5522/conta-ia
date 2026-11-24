// Sprint Cartao Credito PJ (24/06/2026) — queries de cartao + agregados pra dashboard.

import { prisma } from '@/lib/db'
import { lerCarteira } from './carteira'
import { diaDoBrasil } from '@/lib/margem/dia'

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
  /** a fatura mais recente importada (total líquido) */
  monthSpend: number
  monthTxCount: number
  utilizationPct: number
  latestInvoiceMonth: string | null
  isLatestInvoicePaid: boolean
  defaultTreatment: string
  socioPFId: string | null
  /** ⭐ R45 — a régua ÚNICA do disponível (limite − aberta − fechadas não pagas) */
  availableLimit: number
}

/**
 * ⭐⭐ CARTÕES v3 (24/11/2026) — a lista é uma VISTA da carteira (`lerCarteira`), nunca uma conta
 * própria. ⛔ Antes: um `findMany` POR cartão dentro de um `for` (o N+1 do dossiê) e o
 * "disponível" daqui (o do PDF) diferente do do detalhe (`limite − gasto do mês`): duas réguas.
 */
export async function listCardsForCompany(companyId: string): Promise<CardCardSummary[]> {
  const cart = await lerCarteira(companyId, diaDoBrasil(new Date()))
  return cart.cartoes.map((c) => ({
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
    isActive: true,
    monthSpend: c.atual?.total ?? 0,
    monthTxCount: c.atual?.linhas ?? 0,
    utilizationPct: c.usoPct,
    latestInvoiceMonth: c.atual?.mes ?? null,
    isLatestInvoicePaid: c.atual?.estado === 'paga',
    defaultTreatment: c.defaultTreatment,
    socioPFId: c.socioPFId,
    availableLimit: c.disponivel,
  }))
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
