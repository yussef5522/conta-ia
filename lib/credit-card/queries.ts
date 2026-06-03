// Sprint PF Fatia 2 — Queries Prisma + autorização multi-tenant.
//
// 🛡️ Todo acesso passa por checkProfileAccess (Fatia 1).

import { randomUUID } from 'crypto'
import { prisma } from '@/lib/db'
import type {
  CreditCard,
  CreditCardInvoice,
  PersonalTransaction,
} from '@prisma/client'
import {
  checkProfileAccess,
  ProfileAccessError,
} from '@/lib/personal-profile/queries'
import {
  buildInstallments,
  type InstallmentRow,
} from './build-installments'
import {
  calculateInvoiceReference,
  type CardConfig,
} from './calculate-invoice-reference'
import {
  calculateCardSummary,
  nextReferenceOf,
  type CardSummaryResult,
} from './calculate-card-summary'
import {
  calculateProfileCreditSummary,
  type ProfileCreditSummaryResult,
} from './calculate-profile-credit-summary'

export class CreditCardError extends Error {
  constructor(message: string, readonly code: string) {
    super(message)
    this.name = 'CreditCardError'
  }
}

// ============================================================
// Verificações de pertinência
// ============================================================

export async function getCardInProfile(
  profileId: string,
  cardId: string,
): Promise<CreditCard> {
  const card = await prisma.creditCard.findUnique({ where: { id: cardId } })
  if (!card || card.profileId !== profileId || !card.isActive) {
    throw new CreditCardError('Cartão não encontrado', 'CARD_NOT_FOUND')
  }
  return card
}

async function assertInvoiceInCard(
  cardId: string,
  invoiceId: string,
): Promise<CreditCardInvoice> {
  const inv = await prisma.creditCardInvoice.findUnique({
    where: { id: invoiceId },
  })
  if (!inv || inv.creditCardId !== cardId) {
    throw new CreditCardError('Fatura não encontrada', 'INVOICE_NOT_FOUND')
  }
  return inv
}

async function assertAccountInProfile(
  profileId: string,
  accountId: string,
): Promise<void> {
  const acc = await prisma.personalBankAccount.findUnique({
    where: { id: accountId },
    select: { profileId: true },
  })
  if (!acc || acc.profileId !== profileId) {
    throw new CreditCardError('Conta inválida', 'INVALID_ACCOUNT')
  }
}

async function assertCategoryInProfile(
  profileId: string,
  categoryId: string,
): Promise<void> {
  const cat = await prisma.personalCategory.findUnique({
    where: { id: categoryId },
    select: { profileId: true },
  })
  if (!cat || cat.profileId !== profileId) {
    throw new CreditCardError('Categoria inválida', 'INVALID_CATEGORY')
  }
}

// ============================================================
// CRUD Cartão
// ============================================================

export interface CreateCardInput {
  userId: string
  profileId: string
  name: string
  bankName?: string | null
  lastDigits?: string | null
  brand?: string | null
  creditLimit: number
  closingDay: number
  dueDay: number
  closingDayRule?: 'ATUAL' | 'PROXIMA'
  defaultPaymentAccountId?: string | null
}

export async function createCreditCard(input: CreateCardInput): Promise<CreditCard> {
  await checkProfileAccess(input.userId, input.profileId, 'OWNER')

  if (input.creditLimit <= 0) {
    throw new CreditCardError('Limite deve ser maior que zero', 'INVALID_LIMIT')
  }
  if (!Number.isInteger(input.closingDay) || input.closingDay < 1 || input.closingDay > 31) {
    throw new CreditCardError('Dia de fechamento inválido (1-31)', 'INVALID_CLOSING_DAY')
  }
  if (!Number.isInteger(input.dueDay) || input.dueDay < 1 || input.dueDay > 31) {
    throw new CreditCardError('Dia de vencimento inválido (1-31)', 'INVALID_DUE_DAY')
  }
  if (input.closingDay === input.dueDay) {
    throw new CreditCardError(
      'Fechamento e vencimento não podem ser o mesmo dia',
      'INVALID_DATES',
    )
  }
  if (input.defaultPaymentAccountId) {
    await assertAccountInProfile(input.profileId, input.defaultPaymentAccountId)
  }
  return prisma.creditCard.create({
    data: {
      profileId: input.profileId,
      name: input.name,
      bankName: input.bankName ?? null,
      lastDigits: input.lastDigits ?? null,
      brand: input.brand ?? null,
      creditLimit: input.creditLimit,
      closingDay: input.closingDay,
      dueDay: input.dueDay,
      closingDayRule: input.closingDayRule ?? 'ATUAL',
      defaultPaymentAccountId: input.defaultPaymentAccountId ?? null,
    },
  })
}

export async function listCardsForProfile(
  userId: string,
  profileId: string,
): Promise<CreditCard[]> {
  await checkProfileAccess(userId, profileId)
  return prisma.creditCard.findMany({
    where: { profileId, isActive: true },
    orderBy: { createdAt: 'asc' },
  })
}

// ============================================================
// Faturas: get-or-create da invoice alvo
// ============================================================

/**
 * Idempotente: se não existe invoice pra (creditCardId, reference) → cria.
 * Senão retorna a existente.
 */
export async function getOrCreateInvoice(
  cardId: string,
  card: CardConfig,
  purchaseDate: Date,
): Promise<CreditCardInvoice> {
  const ref = calculateInvoiceReference(purchaseDate, card)
  const existing = await prisma.creditCardInvoice.findUnique({
    where: { creditCardId_reference: { creditCardId: cardId, reference: ref.reference } },
  })
  if (existing) return existing
  return prisma.creditCardInvoice.create({
    data: {
      creditCardId: cardId,
      reference: ref.reference,
      closingDate: ref.closingDate,
      dueDate: ref.dueDate,
      status: 'OPEN',
    },
  })
}

// ============================================================
// Compras (à vista + parceladas)
// ============================================================

export interface CreatePurchaseInput {
  userId: string
  profileId: string
  cardId: string
  date: Date
  description: string
  totalAmount: number
  installments: number          // 1 = à vista; 2-24 = parcelado
  categoryId?: string | null
  notes?: string | null
}

export interface CreatePurchaseResult {
  installmentGroupId: string | null
  transactions: PersonalTransaction[]
  invoicesUpdated: CreditCardInvoice[]
}

export async function createPurchase(
  input: CreatePurchaseInput,
): Promise<CreatePurchaseResult> {
  await checkProfileAccess(input.userId, input.profileId, 'OWNER')
  const card = await getCardInProfile(input.profileId, input.cardId)
  if (input.categoryId) {
    await assertCategoryInProfile(input.profileId, input.categoryId)
  }
  if (input.totalAmount <= 0) {
    throw new CreditCardError('Valor deve ser maior que zero', 'INVALID_AMOUNT')
  }

  const rows: InstallmentRow[] = buildInstallments({
    purchaseDate: input.date,
    totalAmount: input.totalAmount,
    installments: input.installments,
    card: {
      closingDay: card.closingDay,
      dueDay: card.dueDay,
      closingDayRule: card.closingDayRule as 'ATUAL' | 'PROXIMA',
    },
  })

  const groupId = rows.length > 1 ? randomUUID() : null

  return prisma.$transaction(async (tx) => {
    const txs: PersonalTransaction[] = []
    const invoicesByRef = new Map<string, CreditCardInvoice>()
    const totalsByInvoice = new Map<string, number>()

    for (const row of rows) {
      // Get-or-create invoice (idempotente)
      let invoice = invoicesByRef.get(row.reference)
      if (!invoice) {
        invoice = await tx.creditCardInvoice.upsert({
          where: {
            creditCardId_reference: {
              creditCardId: card.id,
              reference: row.reference,
            },
          },
          create: {
            creditCardId: card.id,
            reference: row.reference,
            closingDate: row.closingDate,
            dueDate: row.dueDate,
            status: 'OPEN',
          },
          update: {},
        })
        invoicesByRef.set(row.reference, invoice)
      }

      // Descrição da tx
      const descSuffix =
        rows.length > 1 ? ` (${row.installmentNumber}/${row.installmentTotal})` : ''
      const created = await tx.personalTransaction.create({
        data: {
          profileId: input.profileId,
          categoryId: input.categoryId ?? null,
          bankAccountId: null, // tx de cartão NÃO debita conta direto
          date: row.date,
          description: input.description + descSuffix,
          amount: row.amount,
          type: 'DEBIT',
          status: 'RECONCILED',
          origin: 'MANUAL',
          notes: input.notes ?? null,
          creditCardId: card.id,
          creditCardInvoiceId: invoice.id,
          installmentNumber: rows.length > 1 ? row.installmentNumber : null,
          installmentTotal: rows.length > 1 ? row.installmentTotal : null,
          installmentGroupId: groupId,
        },
      })
      txs.push(created)

      totalsByInvoice.set(
        invoice.id,
        (totalsByInvoice.get(invoice.id) ?? 0) + row.amount,
      )
    }

    // Update totalAmount das invoices afetadas
    const invoicesUpdated: CreditCardInvoice[] = []
    for (const [invoiceId, addedAmount] of totalsByInvoice.entries()) {
      const updated = await tx.creditCardInvoice.update({
        where: { id: invoiceId },
        data: { totalAmount: { increment: addedAmount } },
      })
      invoicesUpdated.push(updated)
    }
    return { installmentGroupId: groupId, transactions: txs, invoicesUpdated }
  })
}

// ============================================================
// Estorno (delete compra)
// ============================================================

export interface DeletePurchaseInput {
  userId: string
  profileId: string
  cardId: string
  txId: string
  /** true = estorna TODAS as parcelas do grupo. false = só a tx específica. */
  scope: 'ALL_GROUP' | 'SINGLE'
}

export async function deletePurchase(input: DeletePurchaseInput): Promise<{
  deletedCount: number
  creditsGenerated: number
}> {
  await checkProfileAccess(input.userId, input.profileId, 'OWNER')
  await getCardInProfile(input.profileId, input.cardId)

  const tx0 = await prisma.personalTransaction.findUnique({
    where: { id: input.txId },
  })
  if (!tx0 || tx0.creditCardId !== input.cardId || tx0.profileId !== input.profileId) {
    throw new CreditCardError('Transação não encontrada', 'TX_NOT_FOUND')
  }
  if (!tx0.creditCardInvoiceId) {
    throw new CreditCardError('Transação não é de cartão', 'TX_NOT_CARD')
  }

  // Coleta tx a remover/creditar
  const targetTxs =
    input.scope === 'ALL_GROUP' && tx0.installmentGroupId
      ? await prisma.personalTransaction.findMany({
          where: { installmentGroupId: tx0.installmentGroupId },
        })
      : [tx0]

  let deletedCount = 0
  let creditsGenerated = 0

  await prisma.$transaction(async (tx) => {
    for (const t of targetTxs) {
      if (!t.creditCardInvoiceId) continue
      const invoice = await tx.creditCardInvoice.findUnique({
        where: { id: t.creditCardInvoiceId },
      })
      if (!invoice) continue

      if (invoice.status === 'PAID') {
        // Fatura paga → gera CRÉDITO na PRÓXIMA invoice (OPEN ou cria)
        const nextRef = nextReferenceOf(invoice.reference)
        const card = await tx.creditCard.findUnique({ where: { id: input.cardId } })
        if (!card) continue
        const nextInvRefCalc = calculateInvoiceReference(
          new Date(
            Date.UTC(
              Number(nextRef.split('-')[0]),
              Number(nextRef.split('-')[1]) - 1,
              Math.min(card.closingDay, 28),
            ),
          ),
          {
            closingDay: card.closingDay,
            dueDay: card.dueDay,
            closingDayRule: card.closingDayRule as 'ATUAL' | 'PROXIMA',
          },
        )
        const nextInvoice = await tx.creditCardInvoice.upsert({
          where: {
            creditCardId_reference: {
              creditCardId: input.cardId,
              reference: nextInvRefCalc.reference,
            },
          },
          create: {
            creditCardId: input.cardId,
            reference: nextInvRefCalc.reference,
            closingDate: nextInvRefCalc.closingDate,
            dueDate: nextInvRefCalc.dueDate,
            status: 'OPEN',
          },
          update: {},
        })
        // Cria tx CREDIT (estorno)
        await tx.personalTransaction.create({
          data: {
            profileId: t.profileId,
            categoryId: t.categoryId,
            date: new Date(),
            description: `Crédito estorno: ${t.description}`,
            amount: t.amount,
            type: 'CREDIT',
            status: 'RECONCILED',
            origin: 'MANUAL',
            creditCardId: input.cardId,
            creditCardInvoiceId: nextInvoice.id,
          },
        })
        await tx.creditCardInvoice.update({
          where: { id: nextInvoice.id },
          data: { totalAmount: { decrement: t.amount } },
        })
        // Apaga a tx original
        await tx.personalTransaction.delete({ where: { id: t.id } })
        creditsGenerated++
        deletedCount++
      } else {
        // Fatura não-paga → decrementa totalAmount + delete
        await tx.creditCardInvoice.update({
          where: { id: invoice.id },
          data: { totalAmount: { decrement: t.amount } },
        })
        await tx.personalTransaction.delete({ where: { id: t.id } })
        deletedCount++
      }
    }
  })
  return { deletedCount, creditsGenerated }
}

// ============================================================
// Pagar fatura
// ============================================================

export interface PayInvoiceInput {
  userId: string
  profileId: string
  cardId: string
  invoiceId: string
  paymentAccountId: string
  amount: number
  juros?: number | null
}

export async function payInvoice(input: PayInvoiceInput): Promise<{
  invoice: CreditCardInvoice
  paymentTx: PersonalTransaction
  rotativeTx: PersonalTransaction | null
  jurosTx: PersonalTransaction | null
}> {
  await checkProfileAccess(input.userId, input.profileId, 'OWNER')
  const card = await getCardInProfile(input.profileId, input.cardId)
  const invoice = await assertInvoiceInCard(input.cardId, input.invoiceId)
  await assertAccountInProfile(input.profileId, input.paymentAccountId)

  if (input.amount <= 0) {
    throw new CreditCardError('Valor do pagamento deve ser maior que zero', 'INVALID_PAYMENT_AMOUNT')
  }
  const owed = invoice.totalAmount - invoice.paidAmount
  if (owed <= 0) {
    throw new CreditCardError('Fatura já está paga', 'ALREADY_PAID')
  }
  if (input.amount > owed + 0.01) {
    throw new CreditCardError(
      `Pagamento (R$ ${input.amount}) maior que devido (R$ ${owed.toFixed(2)})`,
      'OVERPAY',
    )
  }

  return prisma.$transaction(async (tx) => {
    // 1. Cria tx débito na conta de pagamento
    const paymentTx = await tx.personalTransaction.create({
      data: {
        profileId: input.profileId,
        bankAccountId: input.paymentAccountId,
        categoryId: null,
        date: new Date(),
        description: `Pagamento fatura ${invoice.reference} · ${card.name}`,
        amount: input.amount,
        type: 'DEBIT',
        status: 'RECONCILED',
        origin: 'MANUAL',
        creditCardId: card.id,
        creditCardInvoiceId: invoice.id,
        isInvoicePayment: true,
      },
    })
    await tx.personalBankAccount.update({
      where: { id: input.paymentAccountId },
      data: { balance: { decrement: input.amount } },
    })

    // 2. Atualiza invoice
    const newPaid = invoice.paidAmount + input.amount
    const willBePaid = newPaid >= invoice.totalAmount - 0.001
    const newStatus = willBePaid ? 'PAID' : 'PARTIAL'

    let rotativeTx: PersonalTransaction | null = null
    let jurosTx: PersonalTransaction | null = null

    // 3. Se ficou parcial, gera rotativo + juros na próxima invoice
    if (!willBePaid) {
      const remaining = invoice.totalAmount - newPaid
      const nextRef = nextReferenceOf(invoice.reference)
      const cardConfig: CardConfig = {
        closingDay: card.closingDay,
        dueDay: card.dueDay,
        closingDayRule: card.closingDayRule as 'ATUAL' | 'PROXIMA',
      }
      // Calcular datas da próxima invoice
      const [ny, nm] = nextRef.split('-').map(Number)
      const proxyDate = new Date(Date.UTC(ny, nm - 1, Math.min(card.closingDay, 28)))
      const nextRefCalc = calculateInvoiceReference(proxyDate, cardConfig)
      const nextInvoice = await tx.creditCardInvoice.upsert({
        where: {
          creditCardId_reference: {
            creditCardId: card.id,
            reference: nextRefCalc.reference,
          },
        },
        create: {
          creditCardId: card.id,
          reference: nextRefCalc.reference,
          closingDate: nextRefCalc.closingDate,
          dueDate: nextRefCalc.dueDate,
          status: 'OPEN',
          carryoverFromInvoiceId: invoice.id,
        },
        update: { carryoverFromInvoiceId: invoice.id },
      })
      rotativeTx = await tx.personalTransaction.create({
        data: {
          profileId: input.profileId,
          bankAccountId: null,
          categoryId: null,
          date: new Date(),
          description: `Rotativo da fatura ${invoice.reference}`,
          amount: remaining,
          type: 'DEBIT',
          status: 'RECONCILED',
          origin: 'MANUAL',
          creditCardId: card.id,
          creditCardInvoiceId: nextInvoice.id,
        },
      })
      await tx.creditCardInvoice.update({
        where: { id: nextInvoice.id },
        data: { totalAmount: { increment: remaining } },
      })

      if (input.juros && input.juros > 0) {
        jurosTx = await tx.personalTransaction.create({
          data: {
            profileId: input.profileId,
            bankAccountId: null,
            categoryId: null,
            date: new Date(),
            description: `Juros do rotativo · fatura ${invoice.reference}`,
            amount: input.juros,
            type: 'DEBIT',
            status: 'RECONCILED',
            origin: 'MANUAL',
            creditCardId: card.id,
            creditCardInvoiceId: nextInvoice.id,
          },
        })
        await tx.creditCardInvoice.update({
          where: { id: nextInvoice.id },
          data: { totalAmount: { increment: input.juros } },
        })
      }
    }

    const updatedInvoice = await tx.creditCardInvoice.update({
      where: { id: invoice.id },
      data: { paidAmount: newPaid, status: newStatus },
    })

    return { invoice: updatedInvoice, paymentTx, rotativeTx, jurosTx }
  })
}

// ============================================================
// Summaries (alimenta dashboard)
// ============================================================

export async function getCardSummary(
  userId: string,
  profileId: string,
  cardId: string,
  now: Date = new Date(),
): Promise<CardSummaryResult> {
  await checkProfileAccess(userId, profileId)
  const card = await getCardInProfile(profileId, cardId)
  const invoices = await prisma.creditCardInvoice.findMany({
    where: { creditCardId: card.id },
    orderBy: { closingDate: 'desc' },
    take: 24,
  })
  // Parcelas FUTURAS não-faturadas (em invoices OPEN com closingDate futura,
  // já contam via totalAmount; não duplicamos aqui).
  // Pra MVP, futureParcelasNotInvoiced fica vazio — toda compra cria sua
  // invoice no mesmo $transaction da compra. Mantido por compatibilidade.
  return calculateCardSummary(
    {
      cardId: card.id,
      creditLimit: card.creditLimit,
      invoices: invoices.map((i) => ({
        id: i.id,
        reference: i.reference,
        closingDate: i.closingDate,
        dueDate: i.dueDate,
        totalAmount: i.totalAmount,
        paidAmount: i.paidAmount,
        status: i.status,
      })),
      futureParcelasNotInvoiced: [],
    },
    now,
  )
}

export async function getProfileCreditSummary(
  userId: string,
  profileId: string,
  now: Date = new Date(),
): Promise<ProfileCreditSummaryResult> {
  await checkProfileAccess(userId, profileId)
  const cards = await listCardsForProfile(userId, profileId)
  const summaries = await Promise.all(
    cards.map((c) => getCardSummary(userId, profileId, c.id, now)),
  )
  return calculateProfileCreditSummary(summaries)
}

// ============================================================
// Saldo previsto (contas - faturas abertas - parcelas futuras)
// ============================================================

export async function getSaldoPrevisto(
  userId: string,
  profileId: string,
): Promise<{
  saldoAtual: number
  faturasAbertas: number
  parcelasFuturas: number
  saldoPrevisto: number
}> {
  await checkProfileAccess(userId, profileId)
  const accounts = await prisma.personalBankAccount.findMany({
    where: { profileId, isActive: true },
    select: { balance: true },
  })
  const saldoAtual = accounts.reduce((s, a) => s + a.balance, 0)

  // Faturas em OPEN/CLOSED/PARTIAL/OVERDUE (não-pagas)
  const invoices = await prisma.creditCardInvoice.findMany({
    where: {
      creditCard: { profileId, isActive: true },
      status: { in: ['OPEN', 'CLOSED', 'PARTIAL', 'OVERDUE'] },
    },
    select: { totalAmount: true, paidAmount: true, closingDate: true },
  })
  // Fatura "corrente" (closingDate <= now+30d) vai pesar agora
  const now = new Date()
  const in30d = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const faturasAbertas = invoices
    .filter((i) => i.closingDate <= in30d)
    .reduce((s, i) => s + (i.totalAmount - i.paidAmount), 0)
  const parcelasFuturas = invoices
    .filter((i) => i.closingDate > in30d)
    .reduce((s, i) => s + (i.totalAmount - i.paidAmount), 0)

  return {
    saldoAtual,
    faturasAbertas,
    parcelasFuturas,
    saldoPrevisto: saldoAtual - faturasAbertas - parcelasFuturas,
  }
}

// Re-export pra UX dos endpoints
export { calculateInvoiceReference, buildInstallments }
export { nextReferenceOf } from './calculate-card-summary'

// Tipo unificado pra erro response
export function isCreditCardError(err: unknown): err is CreditCardError {
  return err instanceof CreditCardError
}
export function isProfileAccessError(err: unknown): err is ProfileAccessError {
  return err instanceof ProfileAccessError
}
