// Sprint PF Fatia 2 — Integração com SQLite dev (queries.ts).

import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { createProfile, createAccount, listCategoriesForProfile } from '@/lib/personal-profile/queries'
import {
  createCreditCard,
  createPurchase,
  deletePurchase,
  payInvoice,
  getCardSummary,
  CreditCardError,
} from '@/lib/credit-card/queries'

const PREFIX = `cc-int-${Date.now()}-${process.pid}`
let userA: { id: string }
let profile: { id: string }
let payAccount: { id: string }
let category: { id: string }

beforeAll(async () => {
  const pwd = await bcrypt.hash('TestPwd123!', 10)
  userA = await prisma.user.create({
    data: { name: 'A', email: `${PREFIX}-a@dev.local`, password: pwd },
  })
  profile = await createProfile({ userId: userA.id, name: 'A self' })
  payAccount = await createAccount({
    userId: userA.id,
    profileId: profile.id,
    name: 'Pay',
    balance: 5000,
  })
  const cats = await listCategoriesForProfile(userA.id, profile.id)
  category = cats.find((c) => c.type === 'EXPENSE') ?? cats[0]
})

afterAll(async () => {
  await prisma.user
    .deleteMany({ where: { email: { contains: PREFIX } } })
    .catch(() => {})
})

describe('createCreditCard', () => {
  test('cria cartão com defaults corretos', async () => {
    const card = await createCreditCard({
      userId: userA.id,
      profileId: profile.id,
      name: 'Nubank teste',
      creditLimit: 5000,
      closingDay: 5,
      dueDay: 12,
    })
    expect(card.closingDayRule).toBe('ATUAL') // default
    expect(card.creditLimit).toBe(5000)
    expect(card.isActive).toBe(true)
  })

  test('rejeita closingDay == dueDay', async () => {
    await expect(
      createCreditCard({
        userId: userA.id,
        profileId: profile.id,
        name: 'Conflito',
        creditLimit: 1000,
        closingDay: 5,
        dueDay: 5,
      }),
    ).rejects.toThrow(CreditCardError)
  })

  test('rejeita creditLimit <= 0', async () => {
    await expect(
      createCreditCard({
        userId: userA.id,
        profileId: profile.id,
        name: 'Limite zero',
        creditLimit: 0,
        closingDay: 5,
        dueDay: 12,
      }),
    ).rejects.toThrow(CreditCardError)
  })
})

describe('createPurchase — à vista', () => {
  let card: { id: string }
  beforeAll(async () => {
    card = await createCreditCard({
      userId: userA.id,
      profileId: profile.id,
      name: 'Avista test',
      creditLimit: 5000,
      closingDay: 5,
      dueDay: 12,
    })
  })

  test('compra 1x cria 1 tx + 1 invoice + updates totalAmount', async () => {
    const result = await createPurchase({
      userId: userA.id,
      profileId: profile.id,
      cardId: card.id,
      date: new Date(Date.UTC(2026, 5, 10)), // 10/jun → fatura jul
      description: 'Netflix',
      totalAmount: 50,
      installments: 1,
      categoryId: category.id,
    })
    expect(result.transactions).toHaveLength(1)
    expect(result.installmentGroupId).toBeNull() // 1x não tem grupo
    expect(result.invoicesUpdated).toHaveLength(1)
    expect(result.invoicesUpdated[0].totalAmount).toBe(50)
    expect(result.invoicesUpdated[0].reference).toBe('2026-07')
  })

  test('compra à vista NÃO debita conta bancária', async () => {
    const accBefore = await prisma.personalBankAccount.findUnique({
      where: { id: payAccount.id },
    })
    await createPurchase({
      userId: userA.id,
      profileId: profile.id,
      cardId: card.id,
      date: new Date(Date.UTC(2026, 5, 10)),
      description: 'Outro gasto',
      totalAmount: 100,
      installments: 1,
    })
    const accAfter = await prisma.personalBankAccount.findUnique({
      where: { id: payAccount.id },
    })
    expect(accBefore?.balance).toBe(accAfter?.balance) // saldo intocado
  })
})

describe('createPurchase — parcelada', () => {
  let card: { id: string }
  beforeAll(async () => {
    card = await createCreditCard({
      userId: userA.id,
      profileId: profile.id,
      name: 'Parcelado',
      creditLimit: 10000,
      closingDay: 5,
      dueDay: 12,
    })
  })

  test('6x cria 6 tx com installmentGroupId compartilhado', async () => {
    const result = await createPurchase({
      userId: userA.id,
      profileId: profile.id,
      cardId: card.id,
      date: new Date(Date.UTC(2026, 5, 10)),
      description: 'TV',
      totalAmount: 600,
      installments: 6,
    })
    expect(result.transactions).toHaveLength(6)
    expect(result.installmentGroupId).not.toBeNull()
    const groupIds = new Set(result.transactions.map((t) => t.installmentGroupId))
    expect(groupIds.size).toBe(1)
    // 6 tx distribuídas em 6 invoices distintas
    expect(result.invoicesUpdated).toHaveLength(6)
    // soma dos amounts = 600
    const sum = result.transactions.reduce((s, t) => s + t.amount, 0)
    expect(Math.round(sum * 100) / 100).toBe(600)
  })

  test('descrição das parcelas inclui "(1/6)"', async () => {
    const result = await createPurchase({
      userId: userA.id,
      profileId: profile.id,
      cardId: card.id,
      date: new Date(Date.UTC(2026, 5, 10)),
      description: 'Geladeira',
      totalAmount: 1200,
      installments: 12,
    })
    expect(result.transactions[0].description).toContain('(1/12)')
    expect(result.transactions[11].description).toContain('(12/12)')
  })
})

describe('payInvoice', () => {
  let card: { id: string }
  let purchaseResult: Awaited<ReturnType<typeof createPurchase>>

  beforeAll(async () => {
    card = await createCreditCard({
      userId: userA.id,
      profileId: profile.id,
      name: 'Pay test',
      creditLimit: 5000,
      closingDay: 5,
      dueDay: 12,
      defaultPaymentAccountId: payAccount.id,
    })
    purchaseResult = await createPurchase({
      userId: userA.id,
      profileId: profile.id,
      cardId: card.id,
      date: new Date(Date.UTC(2026, 5, 10)),
      description: 'Pagamento test',
      totalAmount: 500,
      installments: 1,
    })
  })

  test('pagamento total marca PAID + debita conta', async () => {
    const accBefore = await prisma.personalBankAccount.findUnique({
      where: { id: payAccount.id },
    })
    const result = await payInvoice({
      userId: userA.id,
      profileId: profile.id,
      cardId: card.id,
      invoiceId: purchaseResult.invoicesUpdated[0].id,
      paymentAccountId: payAccount.id,
      amount: 500,
    })
    expect(result.invoice.status).toBe('PAID')
    expect(result.invoice.paidAmount).toBe(500)
    expect(result.paymentTx.isInvoicePayment).toBe(true)
    expect(result.rotativeTx).toBeNull()

    const accAfter = await prisma.personalBankAccount.findUnique({
      where: { id: payAccount.id },
    })
    expect((accAfter?.balance ?? 0)).toBe((accBefore?.balance ?? 0) - 500)
  })

  test('rejeita pagar fatura já paga', async () => {
    await expect(
      payInvoice({
        userId: userA.id,
        profileId: profile.id,
        cardId: card.id,
        invoiceId: purchaseResult.invoicesUpdated[0].id,
        paymentAccountId: payAccount.id,
        amount: 100,
      }),
    ).rejects.toThrow(CreditCardError)
  })
})

describe('payInvoice PARCIAL + rotativo', () => {
  test('pagamento parcial → PARTIAL + tx rotativa + juros opcional na próxima', async () => {
    const card = await createCreditCard({
      userId: userA.id,
      profileId: profile.id,
      name: 'Rotativo',
      creditLimit: 5000,
      closingDay: 5,
      dueDay: 12,
    })
    const purchase = await createPurchase({
      userId: userA.id,
      profileId: profile.id,
      cardId: card.id,
      date: new Date(Date.UTC(2026, 5, 10)),
      description: 'Fatura grande',
      totalAmount: 1000,
      installments: 1,
    })
    const invoice = purchase.invoicesUpdated[0]
    const result = await payInvoice({
      userId: userA.id,
      profileId: profile.id,
      cardId: card.id,
      invoiceId: invoice.id,
      paymentAccountId: payAccount.id,
      amount: 600,
      juros: 50,
    })
    expect(result.invoice.status).toBe('PARTIAL')
    expect(result.invoice.paidAmount).toBe(600)
    expect(result.rotativeTx).not.toBeNull()
    expect(result.rotativeTx?.amount).toBe(400) // 1000 - 600
    expect(result.jurosTx?.amount).toBe(50)

    // Próxima invoice tem totalAmount = 400 + 50 = 450
    const nextInvoice = await prisma.creditCardInvoice.findFirst({
      where: { creditCardId: card.id, carryoverFromInvoiceId: invoice.id },
    })
    expect(nextInvoice).not.toBeNull()
    expect(nextInvoice?.totalAmount).toBe(450)
  })
})

describe('deletePurchase — estorno', () => {
  let card: { id: string }
  let purchase: Awaited<ReturnType<typeof createPurchase>>

  beforeAll(async () => {
    card = await createCreditCard({
      userId: userA.id,
      profileId: profile.id,
      name: 'Estorno',
      creditLimit: 5000,
      closingDay: 5,
      dueDay: 12,
    })
    purchase = await createPurchase({
      userId: userA.id,
      profileId: profile.id,
      cardId: card.id,
      date: new Date(Date.UTC(2026, 5, 10)),
      description: 'TV pra estornar',
      totalAmount: 600,
      installments: 6,
    })
  })

  test('SINGLE: deleta SÓ a parcela escolhida + decrementa sua invoice', async () => {
    const tx0 = purchase.transactions[0]
    const invBefore = await prisma.creditCardInvoice.findUnique({
      where: { id: tx0.creditCardInvoiceId! },
    })
    const result = await deletePurchase({
      userId: userA.id,
      profileId: profile.id,
      cardId: card.id,
      txId: tx0.id,
      scope: 'SINGLE',
    })
    expect(result.deletedCount).toBe(1)
    const invAfter = await prisma.creditCardInvoice.findUnique({
      where: { id: tx0.creditCardInvoiceId! },
    })
    expect(invAfter?.totalAmount).toBe((invBefore?.totalAmount ?? 0) - tx0.amount)
    // Outras parcelas continuam
    const remaining = await prisma.personalTransaction.count({
      where: { installmentGroupId: tx0.installmentGroupId! },
    })
    expect(remaining).toBe(5)
  })

  test('ALL_GROUP: deleta TODAS as parcelas restantes (5)', async () => {
    const tx1 = purchase.transactions[1]
    const result = await deletePurchase({
      userId: userA.id,
      profileId: profile.id,
      cardId: card.id,
      txId: tx1.id,
      scope: 'ALL_GROUP',
    })
    expect(result.deletedCount).toBe(5) // só 5 sobraram após o teste anterior
    const remaining = await prisma.personalTransaction.count({
      where: { installmentGroupId: tx1.installmentGroupId! },
    })
    expect(remaining).toBe(0)
  })
})

describe('getCardSummary — integração real', () => {
  test('calcula limite usado de cartão com 1 compra à vista', async () => {
    const card = await createCreditCard({
      userId: userA.id,
      profileId: profile.id,
      name: 'Summary teste',
      creditLimit: 2000,
      closingDay: 5,
      dueDay: 12,
    })
    await createPurchase({
      userId: userA.id,
      profileId: profile.id,
      cardId: card.id,
      date: new Date(Date.UTC(2026, 5, 10)),
      description: 'Compra',
      totalAmount: 300,
      installments: 1,
    })
    const summary = await getCardSummary(userA.id, profile.id, card.id)
    expect(summary.creditLimit).toBe(2000)
    expect(summary.limitUsed).toBe(300)
    expect(summary.limitAvailable).toBe(1700)
  })
})
