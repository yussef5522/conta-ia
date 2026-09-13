// ⭐ O QUE O MOTOR PRECISA SABER DO BANCO (13/09) — leitura, num lugar só.
//
// ⚠️ Ele carrega SÓ o do perfil: `profileId` em toda consulta. É o que faz o guard de
// isolamento entre perfis ser verdade por construção, e não por promessa.

import { prisma as defaultPrisma } from '@/lib/db'
import type { ContaPF } from './orquestrador'
import type { TxExistente } from './casar-com-existente'
import type { FaturaAberta } from './conferencia-e-fatura'

type Db = typeof defaultPrisma

export async function carregarContexto(profileId: string, contaId: string, db: Db = defaultPrisma): Promise<{
  conta: ContaPF; existentes: TxExistente[]; faturas: FaturaAberta[]
} | null> {
  const conta = await db.personalBankAccount.findFirst({
    where: { id: contaId, profileId },
    select: { id: true, name: true, bankCode: true, bankName: true, accountNumber: true, balance: true, ledgerBal: true, ledgerBalDate: true },
  })
  if (!conta) return null

  const txs = await db.personalTransaction.findMany({
    // ⚠️ as candidatas ao casamento são as DA CONTA (ou sem conta, que é como a ponte
    // às vezes lança) — nunca as de cartão: aquelas são compras, não movimento bancário.
    where: { profileId, creditCardId: null },
    select: { id: true, date: true, amount: true, type: true, description: true, origin: true, dedupHash: true, categoryId: true, bridge: { select: { id: true } } },
  })

  const cards = await db.creditCard.findMany({
    where: { profileId, isActive: true },
    select: { id: true, name: true, bankName: true, lastDigits: true },
  })
  const invoices = cards.length
    ? await db.creditCardInvoice.findMany({
      where: { creditCardId: { in: cards.map((c) => c.id) }, status: { in: ['OPEN', 'CLOSED', 'PARTIAL', 'OVERDUE'] } },
      select: { id: true, creditCardId: true, reference: true, dueDate: true, totalAmount: true, paidAmount: true },
    })
    : []
  const porCard = new Map(cards.map((c) => [c.id, c]))

  return {
    conta,
    existentes: txs.map((t): TxExistente => ({
      id: t.id, data: t.date, descricao: t.description, origem: t.origin, dedupHash: t.dedupHash,
      valorComSinal: t.type === 'CREDIT' ? Math.abs(t.amount) : -Math.abs(t.amount),
      temPonte: !!t.bridge, categoriaId: t.categoryId,
    })),
    faturas: invoices.map((f): FaturaAberta => {
      const c = porCard.get(f.creditCardId)!
      return {
        invoiceId: f.id, cardId: c.id, cardNome: c.name, bankName: c.bankName, lastDigits: c.lastDigits,
        referencia: f.reference, vencimento: f.dueDate,
        emAberto: Math.round((f.totalAmount - f.paidAmount) * 100) / 100,
        // ⛔ só cartão ATIVO chega aqui (o `banrisul pf ****9113` vazio fica de fora)
        cardAtivo: true,
      }
    }),
  }
}
