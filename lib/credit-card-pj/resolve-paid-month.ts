// CARTAO — competência que um pagamento quita (17/08). ÚNICA função: a tela
// (casar-pagamento) E o import (apply-marks) chamam ela → impossível um caminho
// setar paidInvoiceMonth e o outro não (REGRA 4/5). Era o bug: o import auto-flagava
// isCardPayment mas nunca setava o mês → a fatura ficava OPEN pra sempre.
//
// A competência = a fatura cujo NET bate o valor pago. **Nenhuma bate → `null`.**
//
// ⚠️⚠️ ESTE COMENTÁRIO JÁ MENTIU: ele dizia "NUNCA 'a mais recente'" enquanto o
// `pickInvoiceMonthByValue` terminava num `sort().pop()` — e foi esse fallback que mandou o
// pagamento de 12.696,23 pra 2026-09 em 20/10, porque o banner da prévia do import casa
// ANTES de a fatura existir. O fallback morreu; agora a promessa e o código concordam.
//
// ⛔ Quem recebe `null` **recusa ensinando** — ver `casarPagamentoDeCartao` (tela) e o ramo
// PAGAMENTO_CARTAO do `aplicar-marcacao` (import), que NÃO grava meia-marca: cartão com
// `paidInvoiceMonth` nulo deixa a linha com selo de "fatura paga" e a fatura OPEN pra
// sempre (o bug do Carter, 20/09 — `faturaVinculada` olha só o `businessCreditCardId`).

import type { PrismaClient, Prisma } from '@prisma/client'
import { signedFaturaAmount, pickInvoiceMonthByValue } from './fatura-net-total'

type Db = PrismaClient | Prisma.TransactionClient

export async function resolvePaidInvoiceMonth(db: Db, cardId: string, amount: number): Promise<string | null> {
  const items = await db.transaction.findMany({
    where: { businessCreditCardId: cardId, invoiceMonth: { not: null }, isCardPayment: false },
    select: { invoiceMonth: true, type: true, amount: true },
  })
  if (items.length === 0) return null
  const netByMonth = new Map<string, number>()
  for (const it of items) {
    const m = it.invoiceMonth as string
    netByMonth.set(m, (netByMonth.get(m) ?? 0) + signedFaturaAmount({ type: it.type, amount: it.amount }))
  }
  return pickInvoiceMonthByValue(netByMonth, amount)
}
