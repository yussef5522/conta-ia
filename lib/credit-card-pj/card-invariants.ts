// CARTAO — invariantes do juiz (17/08). Começa por K3 (o bug ao vivo: pagamento
// casado no import que não fechou a fatura). K1/K2/K4-K7 entram na FASE 3 completa.
// Só competência de agosto pra frente (foco agosto; jun/jul = divergência conhecida).
//
// K3: nenhum pagamento de cartão ÓRFÃO (isCardPayment=true, paidInvoiceMonth=null)
//     cujo valor == o net de alguma fatura OPEN do mesmo cartão/empresa. É o "casar
//     que ninguém fez" — o pagamento existe, a fatura existe, e ninguém amarrou.

import type { PrismaClient, Prisma } from '@prisma/client'
import { faturaNetTotal } from './fatura-net-total'

type Db = PrismaClient | Prisma.TransactionClient

export interface CardInvariantFail {
  invariante: string
  companyId: string
  companyName: string
  detalhe: string
}

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100
const MODULE_INICIO_MES = '2026-08' // foco agosto (>=)

export async function checkCardInvariants(db: Db, companyId: string, companyName: string): Promise<CardInvariantFail[]> {
  const fails: CardInvariantFail[] = []
  const cards = await db.businessCreditCard.findMany({ where: { companyId }, select: { id: true, name: true } })
  if (cards.length === 0) return fails
  const cardIds = cards.map((c) => c.id)
  const cardName = new Map(cards.map((c) => [c.id, c.name]))

  // Linhas de fatura (não-pagamento), agosto+, agrupadas por (cartão, mês) → net.
  const linhas = await db.transaction.findMany({
    where: { businessCreditCardId: { in: cardIds }, isCardPayment: false, invoiceMonth: { gte: MODULE_INICIO_MES } },
    select: { businessCreditCardId: true, invoiceMonth: true, type: true, amount: true },
  })
  const netPorFatura = new Map<string, number>() // "cardId|mês" → net
  const itensPorFatura = new Map<string, { type: string; amount: number }[]>()
  for (const l of linhas) {
    const k = `${l.businessCreditCardId}|${l.invoiceMonth}`
    const arr = itensPorFatura.get(k) ?? []
    arr.push({ type: l.type, amount: l.amount })
    itensPorFatura.set(k, arr)
  }
  for (const [k, itens] of itensPorFatura) netPorFatura.set(k, faturaNetTotal(itens).net)

  // Faturas PAGAS: existe pagamento com (cartão, paidInvoiceMonth) == (cartão, mês).
  const pagamentos = await db.transaction.findMany({
    where: { isCardPayment: true, bankAccount: { companyId } },
    select: { id: true, amount: true, businessCreditCardId: true, paidInvoiceMonth: true, date: true, description: true },
  })
  const pagas = new Set<string>()
  for (const p of pagamentos) if (p.businessCreditCardId && p.paidInvoiceMonth) pagas.add(`${p.businessCreditCardId}|${p.paidInvoiceMonth}`)

  // Faturas OPEN = tem net (!=0) e não está paga.
  const faturasOpen: { key: string; net: number }[] = []
  for (const [k, net] of netPorFatura) if (Math.abs(net) > 0.02 && !pagas.has(k)) faturasOpen.push({ key: k, net })

  // K3 — pagamento órfão (sem paidInvoiceMonth) cujo valor bate uma fatura OPEN.
  const orfaos = pagamentos.filter((p) => !p.paidInvoiceMonth)
  for (const o of orfaos) {
    const match = faturasOpen.find((f) => Math.abs(round2(f.net) - o.amount) <= Math.max(0.02, o.amount * 0.02))
    if (match) {
      const [cardId, mes] = match.key.split('|')
      fails.push({
        invariante: 'K3',
        companyId,
        companyName,
        detalhe: `pagamento ÓRFÃO ${o.amount.toFixed(2)} (${o.date.toISOString().slice(0, 10)}, "${(o.description ?? '').slice(0, 25)}") bate a fatura OPEN ${cardName.get(cardId) ?? cardId} ${mes} (net ${match.net.toFixed(2)}) — casar (tx ${o.id})`,
      })
    }
  }

  return fails
}
