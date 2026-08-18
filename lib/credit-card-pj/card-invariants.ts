// CARTAO — invariantes K1-K7 do juiz noturno (FASE 3, 18/08). Só competência de
// agosto pra frente (foco agosto; jun/jul = divergência conhecida). P2/P4/P5/P7 do
// sprint nascem aqui como K (uma implementação, não duas).
//
// K1 cache não apodrece: lastInvoiceTotalToPay do cartão == faturaNetTotal recomputado
// K2 fatura PAID: exatamente 1 pagamento vinculado, valor == net, mês bate
// K3 pagamento ÓRFÃO cujo valor bate uma fatura OPEN (o "casar que ninguém fez")
// K4 CREDIT nunca somado como débito: toda linha amount > 0 (sinal vem do type)
// K5 fila A_CLASSIFICAR: reporta count/soma; alerta se a mais antiga passou de 30 dias
// K6 NON_LEARNABLE intacto: nenhuma AiLearningRule aponta pra A_CLASSIFICAR
// K7 Vision: fatura agosto+ de banco SEM parser determinístico entrou por Vision (meta 0)

import type { PrismaClient, Prisma } from '@prisma/client'
import { faturaNetTotal } from './fatura-net-total'
import { hasDeterministicParser } from './extract-invoice-smart'
import { CARD_REVIEW_DRE_GROUP } from './card-withdrawal-category'

type Db = PrismaClient | Prisma.TransactionClient

export interface CardInvariantFail {
  invariante: string
  companyId: string
  companyName: string
  detalhe: string
}
export interface CardResumo {
  filaCount: number
  filaSoma: number
  filaMaisAntigaDias: number | null
  visionBancos: string[]
}

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100
const MODULE_INICIO_MES = '2026-08'
const FILA_ALERTA_DIAS = 30 // K5: fila tem que esvaziar em 30 dias

export async function checkCardInvariants(
  db: Db,
  companyId: string,
  companyName: string,
  now: Date,
): Promise<{ fails: CardInvariantFail[]; resumo: CardResumo }> {
  const fails: CardInvariantFail[] = []
  const F = (invariante: string, detalhe: string) => fails.push({ invariante, companyId, companyName, detalhe })

  const cards = await db.businessCreditCard.findMany({
    where: { companyId },
    select: { id: true, name: true, bankName: true, lastInvoiceMonth: true, lastInvoiceTotalToPay: true },
  })
  const cardName = new Map(cards.map((c) => [c.id, c.name]))
  const emptyResumo: CardResumo = { filaCount: 0, filaSoma: 0, filaMaisAntigaDias: null, visionBancos: [] }
  if (cards.length === 0) return { fails, resumo: emptyResumo }
  const cardIds = cards.map((c) => c.id)

  // Linhas de fatura (não-pagamento), agosto+, por (cartão, mês).
  const linhas = await db.transaction.findMany({
    where: { businessCreditCardId: { in: cardIds }, isCardPayment: false, invoiceMonth: { gte: MODULE_INICIO_MES } },
    select: { businessCreditCardId: true, invoiceMonth: true, type: true, amount: true },
  })
  const itensPorFatura = new Map<string, { type: string; amount: number }[]>()
  for (const l of linhas) {
    const k = `${l.businessCreditCardId}|${l.invoiceMonth}`
    ;(itensPorFatura.get(k) ?? itensPorFatura.set(k, []).get(k)!).push({ type: l.type, amount: l.amount })
    // K4 — amount tem que ser positivo (o sinal vem do type; CREDIT negativo = bug)
    if (l.amount <= 0) F('K4', `${cardName.get(l.businessCreditCardId!)} ${l.invoiceMonth}: linha com amount ${l.amount} (deve ser > 0; sinal vem do type)`)
  }
  const netPorFatura = new Map<string, number>()
  for (const [k, itens] of itensPorFatura) netPorFatura.set(k, faturaNetTotal(itens).net)

  // Pagamentos da empresa.
  const pagamentos = await db.transaction.findMany({
    where: { isCardPayment: true, bankAccount: { companyId } },
    select: { id: true, amount: true, businessCreditCardId: true, paidInvoiceMonth: true, date: true, description: true },
  })
  const pagsPorFatura = new Map<string, typeof pagamentos>()
  for (const p of pagamentos) if (p.businessCreditCardId && p.paidInvoiceMonth) {
    const k = `${p.businessCreditCardId}|${p.paidInvoiceMonth}`
    ;(pagsPorFatura.get(k) ?? pagsPorFatura.set(k, []).get(k)!).push(p)
  }

  // K1 — cache de metadata do cartão vs recompute.
  for (const c of cards) {
    if (c.lastInvoiceMonth && c.lastInvoiceMonth >= MODULE_INICIO_MES && c.lastInvoiceTotalToPay != null) {
      const net = netPorFatura.get(`${c.id}|${c.lastInvoiceMonth}`)
      if (net != null && Math.abs(round2(net) - c.lastInvoiceTotalToPay) > 0.02) {
        F('K1', `${c.name} ${c.lastInvoiceMonth}: total gravado ${c.lastInvoiceTotalToPay.toFixed(2)} vs recomputado ${net.toFixed(2)} (cache podre)`)
      }
    }
  }

  // K2 — fatura PAID: 1 pagamento, valor == net, mês bate.
  for (const [k, net] of netPorFatura) {
    const pags = pagsPorFatura.get(k)
    if (!pags || pags.length === 0) continue // OPEN — não é K2
    const [cardId, mes] = k.split('|')
    if (pags.length !== 1) F('K2', `${cardName.get(cardId)} ${mes}: ${pags.length} pagamentos vinculados (esperado 1)`)
    for (const p of pags) if (Math.abs(round2(net) - p.amount) > 0.02) {
      F('K2', `${cardName.get(cardId)} ${mes}: pagamento ${p.amount.toFixed(2)} != net ${round2(net).toFixed(2)}`)
    }
  }

  // Faturas OPEN (net != 0, sem pagamento) — pro K3.
  const faturasOpen: { key: string; net: number }[] = []
  for (const [k, net] of netPorFatura) if (Math.abs(net) > 0.02 && !pagsPorFatura.has(k)) faturasOpen.push({ key: k, net })

  // K3 — pagamento órfão (sem paidInvoiceMonth) que bate uma fatura OPEN.
  for (const o of pagamentos.filter((p) => !p.paidInvoiceMonth)) {
    const match = faturasOpen.find((f) => Math.abs(round2(f.net) - o.amount) <= Math.max(0.02, o.amount * 0.02))
    if (match) {
      const [cardId, mes] = match.key.split('|')
      F('K3', `pagamento ÓRFÃO ${o.amount.toFixed(2)} (${o.date.toISOString().slice(0, 10)}) bate a fatura OPEN ${cardName.get(cardId)} ${mes} (net ${match.net.toFixed(2)}) — casar (tx ${o.id})`)
    }
  }

  // K5 — fila A_CLASSIFICAR (report + alerta por idade).
  const fila = await db.transaction.findMany({
    where: { category: { companyId, dreGroup: CARD_REVIEW_DRE_GROUP } },
    select: { amount: true, type: true, date: true },
    orderBy: { date: 'asc' },
  })
  const filaSoma = round2(fila.reduce((s, t) => s + (t.type === 'CREDIT' ? -t.amount : t.amount), 0))
  const filaMaisAntigaDias = fila[0] ? Math.floor((now.getTime() - fila[0].date.getTime()) / 86400000) : null
  if (filaMaisAntigaDias != null && filaMaisAntigaDias > FILA_ALERTA_DIAS) {
    F('K5', `fila A_CLASSIFICAR: ${fila.length} linhas / ${filaSoma.toFixed(2)} — a mais antiga tem ${filaMaisAntigaDias} dias (> ${FILA_ALERTA_DIAS}; tem que esvaziar)`)
  }

  // K6 — NON_LEARNABLE: nenhuma regra aprendida aponta pra A_CLASSIFICAR.
  const catsRevisao = await db.category.findMany({ where: { companyId, dreGroup: CARD_REVIEW_DRE_GROUP }, select: { id: true } })
  if (catsRevisao.length > 0) {
    const n = await db.aiLearningRule.count({ where: { categoryId: { in: catsRevisao.map((c) => c.id) } } })
    if (n > 0) F('K6', `${n} AiLearningRule apontam pra A_CLASSIFICAR (NON_LEARNABLE violado)`)
  }

  // K7 — Vision: fatura agosto+ de banco SEM parser determinístico.
  const cardsComFatura = new Set(linhas.map((l) => l.businessCreditCardId))
  const visionBancos: string[] = []
  for (const c of cards) {
    if (cardsComFatura.has(c.id) && !hasDeterministicParser(c.bankName)) {
      visionBancos.push(c.name)
      F('K7', `${c.name} (${c.bankName}) tem fatura agosto+ mas SEM parser determinístico — entrou por Vision (meta zero; parser é a FASE 4)`)
    }
  }

  return { fails, resumo: { filaCount: fila.length, filaSoma, filaMaisAntigaDias, visionBancos } }
}
