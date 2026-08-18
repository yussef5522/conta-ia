// Sprint Cartao-A-Classificar (14/08/2026) — a FILA "A CLASSIFICAR".
//
// "Não pode ser silenciosa" (Yussef): a tela mostra quantas compras estão paradas
// aguardando classificação, desde quando, e o total. O objetivo é ESVAZIAR, não
// crescer. Fonte única da fila (dreGroup A_CLASSIFICAR) — count/soma/mais-antiga/ids.

import type { PrismaClient, Prisma } from '@prisma/client'
import { signedFaturaAmount } from './fatura-net-total'

type Db = PrismaClient | Prisma.TransactionClient
const round2 = (n: number) => Math.round(n * 100) / 100

export interface ReviewQueue {
  count: number
  sum: number // soma líquida (estorno subtrai)
  oldestMonth: string | null // YYYY-MM da mais antiga
  ids: string[]
}

/** Transações na fila "A CLASSIFICAR" da empresa (opcionalmente de um cartão). */
export async function getReviewQueue(db: Db, companyId: string, cardId?: string): Promise<ReviewQueue> {
  const tx = await db.transaction.findMany({
    where: {
      category: { companyId, dreGroup: 'A_CLASSIFICAR' },
      ...(cardId ? { businessCreditCardId: cardId } : {}),
    },
    select: { id: true, amount: true, date: true, type: true },
    orderBy: { date: 'asc' },
  })
  // Sinal pela fn ÚNICA (signedFaturaAmount) — não inline (REGRA 4/6: CREDIT subtrai
  // em TODO Σ, um lugar só define o sinal).
  const sum = round2(tx.reduce((s, t) => s + signedFaturaAmount(t), 0))
  return {
    count: tx.length,
    sum,
    oldestMonth: tx[0] ? tx[0].date.toISOString().slice(0, 7) : null,
    ids: tx.map((t) => t.id),
  }
}
