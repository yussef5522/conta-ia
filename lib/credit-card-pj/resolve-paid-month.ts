// CARTAO — competência que um pagamento quita (17/08). ÚNICA função: a tela
// (casar-pagamento) E o import (apply-marks) chamam ela → impossível um caminho
// setar paidInvoiceMonth e o outro não (REGRA 4/5). Era o bug: o import auto-flagava
// isCardPayment mas nunca setava o mês → a fatura ficava OPEN pra sempre.
//
// A competência = a fatura cujo NET bate o valor pago. NUNCA "a mais recente" — esse
// era o bug sistêmico (o 7.896,32 caiu em julho porque agosto ainda não existia).

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
