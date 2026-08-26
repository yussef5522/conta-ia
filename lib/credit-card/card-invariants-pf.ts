// CARTÃO **PF** — invariantes KP1-KP6 do juiz noturno (26/08).
//
// ⚠️ POR QUE EXISTE: até hoje o cartão PF tinha **ZERO invariante**. O K-series só
// olhava `businessCreditCard` (PJ). Módulo de dinheiro sem juiz é módulo que erra em
// silêncio — foi a regra que pegou a VendaDiaria duplicada e o pagamento órfão do
// Caixa. O dono foi direto ao ponto: *"não pode viver sem juiz"*.
//
// ⭐ E A PF DÁ PRA SER MAIS DURA QUE A PJ: aqui a fatura é uma LINHA REAL
// (`CreditCardInvoice`) com `status` e `paidAmount` próprios, enquanto na PJ "paga" é
// DERIVADO (existe pagamento com `paidInvoiceMonth` batendo?). Ter o estado gravado
// permite checar a COERÊNCIA do estado — coisa que na PJ nem faz sentido perguntar.
// Por isso o KP2 e o KP5 não têm irmão do lado PJ.
//
// KP1 fatura não apodrece: totalAmount == Σ das linhas do cartão nela
// KP2 estado coerente: PAID ⇒ paidAmount >= totalAmount · OPEN/CLOSED ⇒ paidAmount 0
// KP3 pagamento ÓRFÃO: débito no extrato que bate uma fatura fechada e ninguém casou
// KP4 sinal: toda linha amount > 0 (o sinal vem do `type`, igual PJ)
// KP5 pagamento sem fatura: isInvoicePayment=true sem creditCardInvoiceId
// KP6 fatura vencida sem pagamento há mais de 10 dias (o dono esqueceu, ou faltou casar)

import type { PrismaClient, Prisma } from '@prisma/client'

type Db = PrismaClient | Prisma.TransactionClient

export interface CardPFInvariantFail {
  invariante: string
  profileId: string
  profileName: string
  detalhe: string
}

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100
const TOL = 0.02
/** KP6: fatura vencida sem pagamento por mais que isto vira alerta. */
export const DIAS_VENCIDA_ALERTA = 10
/** KP3: janela em torno do vencimento pra procurar o pagamento que ninguém casou. */
export const JANELA_ORFAO_DIAS = 12

export async function checkCardInvariantsPF(
  db: Db,
  profileId: string,
  profileName: string,
  now: Date,
): Promise<CardPFInvariantFail[]> {
  const fails: CardPFInvariantFail[] = []
  const F = (invariante: string, detalhe: string) =>
    fails.push({ invariante, profileId, profileName, detalhe })
  const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const cards = await db.creditCard.findMany({
    where: { profileId },
    select: { id: true, name: true, lastDigits: true },
  })
  if (cards.length === 0) return fails
  const cardIds = cards.map((c) => c.id)
  const nomeCartao = new Map(cards.map((c) => [c.id, `${c.name}${c.lastDigits ? ` ****${c.lastDigits}` : ''}`]))

  const invoices = await db.creditCardInvoice.findMany({
    where: { creditCardId: { in: cardIds } },
    select: {
      id: true, creditCardId: true, reference: true, status: true,
      totalAmount: true, paidAmount: true, dueDate: true,
    },
  })
  if (invoices.length === 0) return fails

  const linhas = await db.personalTransaction.findMany({
    where: { creditCardInvoiceId: { in: invoices.map((i) => i.id) } },
    select: { id: true, creditCardInvoiceId: true, amount: true, type: true, isInvoicePayment: true, description: true },
  })

  // ── KP1 + KP4: soma das linhas × total gravado, e o sinal de cada uma ──
  const somaPorFatura = new Map<string, number>()
  for (const l of linhas) {
    if (l.amount <= 0) {
      F('KP4', `lançamento "${l.description.slice(0, 40)}" com amount ${l.amount} (deve ser > 0; o sinal vem do type)`)
    }
    if (l.isInvoicePayment) continue // pagamento não compõe o total da fatura
    const k = l.creditCardInvoiceId!
    somaPorFatura.set(k, round2((somaPorFatura.get(k) ?? 0) + (l.type === 'CREDIT' ? -l.amount : l.amount)))
  }

  for (const inv of invoices) {
    const rot = `${nomeCartao.get(inv.creditCardId) ?? inv.creditCardId} ${inv.reference}`
    const soma = somaPorFatura.get(inv.id) ?? 0
    if (Math.abs(soma - inv.totalAmount) > TOL) {
      F('KP1', `${rot}: totalAmount gravado ${brl(inv.totalAmount)} vs Σ das linhas ${brl(soma)} — fatura desatualizada ou linha órfã`)
    }

    // ── KP2: o estado tem que ser coerente com o dinheiro ──
    if (inv.status === 'PAID' && inv.paidAmount < inv.totalAmount - 0.001) {
      F('KP2', `${rot}: marcada PAGA mas paidAmount ${brl(inv.paidAmount)} < total ${brl(inv.totalAmount)}`)
    }
    if ((inv.status === 'OPEN' || inv.status === 'CLOSED') && inv.paidAmount > TOL) {
      F('KP2', `${rot}: status ${inv.status} mas já tem ${brl(inv.paidAmount)} pago — deveria ser PARTIAL ou PAID`)
    }
    if (inv.paidAmount > inv.totalAmount + TOL) {
      F('KP2', `${rot}: pago ${brl(inv.paidAmount)} MAIOR que o total ${brl(inv.totalAmount)}`)
    }

    // ── KP6: vencida e ninguém pagou ──
    const diasVencida = Math.floor((now.getTime() - inv.dueDate.getTime()) / 86_400_000)
    const emAberto = inv.status !== 'PAID' && inv.totalAmount > 0
    if (emAberto && diasVencida > DIAS_VENCIDA_ALERTA) {
      F('KP6', `${rot}: venceu há ${diasVencida} dias e continua ${inv.status} (devido ${brl(round2(inv.totalAmount - inv.paidAmount))}) — pagou e faltou casar?`)
    }
  }

  // ── KP5: pagamento que não aponta pra fatura nenhuma ──
  const pagamentosSoltos = await db.personalTransaction.findMany({
    where: { profileId, isInvoicePayment: true, creditCardInvoiceId: null },
    select: { id: true, date: true, amount: true, description: true },
  })
  for (const p of pagamentosSoltos) {
    F('KP5', `pagamento de fatura ${brl(p.amount)} em ${p.date.toISOString().slice(0, 10)} SEM fatura vinculada ("${p.description.slice(0, 40)}")`)
  }

  // ── KP3: o "casar que ninguém fez" ──
  // Débito no extrato, perto do vencimento, com valor batendo o devido de uma fatura
  // que ainda não está paga. É achado ACIONÁVEL (um clique), não erro de dado.
  const abertas = invoices.filter((i) => i.status !== 'PAID' && round2(i.totalAmount - i.paidAmount) > TOL)
  if (abertas.length > 0) {
    const ms = JANELA_ORFAO_DIAS * 86_400_000
    const minData = new Date(Math.min(...abertas.map((i) => i.dueDate.getTime())) - ms)
    const maxData = new Date(Math.max(...abertas.map((i) => i.dueDate.getTime())) + ms)
    const debitos = await db.personalTransaction.findMany({
      where: {
        profileId, type: 'DEBIT', isInvoicePayment: false, creditCardId: null,
        bankAccountId: { not: null }, date: { gte: minData, lte: maxData },
      },
      select: { id: true, date: true, amount: true, description: true },
    })
    for (const inv of abertas) {
      const devido = round2(inv.totalAmount - inv.paidAmount)
      const bate = debitos.find(
        (d) =>
          Math.abs(d.amount - devido) <= TOL &&
          Math.abs(d.date.getTime() - inv.dueDate.getTime()) <= ms,
      )
      if (bate) {
        const rot = `${nomeCartao.get(inv.creditCardId) ?? inv.creditCardId} ${inv.reference}`
        F('KP3', `pagamento ÓRFÃO ${brl(bate.amount)} (${bate.date.toISOString().slice(0, 10)}) bate a fatura ${rot} em aberto (devido ${brl(devido)}) — casar (tx ${bate.id})`)
      }
    }
  }

  return fails
}
