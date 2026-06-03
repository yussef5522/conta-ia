// Sprint PF Fatia 2 — Isolamento multi-tenant nos ENDPOINTS REST. 15 testes.

import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import bcrypt from 'bcryptjs'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { createProfile, createAccount } from '@/lib/personal-profile/queries'
import { createCreditCard, createPurchase } from '@/lib/credit-card/queries'

const PREFIX = `cc-mt-${Date.now()}-${process.pid}`

const mockGetAuthUser = vi.fn()
vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>()
  return { ...actual, getAuthUser: (req: NextRequest) => mockGetAuthUser(req) }
})

const { GET: getCards, POST: postCard } = await import('@/app/api/perfis/[id]/cartoes/route')
const { GET: getCard, PATCH: patchCard, DELETE: deleteCard } = await import(
  '@/app/api/perfis/[id]/cartoes/[cardId]/route'
)
const { POST: postPurchase } = await import('@/app/api/perfis/[id]/cartoes/[cardId]/compras/route')
const { DELETE: deletePurchaseEp } = await import(
  '@/app/api/perfis/[id]/cartoes/[cardId]/compras/[txId]/route'
)
const { POST: postPay } = await import(
  '@/app/api/perfis/[id]/cartoes/[cardId]/faturas/[invoiceId]/pagar/route'
)
const { POST: postPreview } = await import(
  '@/app/api/perfis/[id]/cartoes/[cardId]/installments-preview/route'
)

let userA: { id: string }
let userB: { id: string }
let profileA: { id: string }
let profileB: { id: string }
let profileA2: { id: string }
let cardA: { id: string }
let cardA2: { id: string }
let cardB: { id: string }
let accB: { id: string }
let purchaseA: Awaited<ReturnType<typeof createPurchase>>

beforeAll(async () => {
  const pwd = await bcrypt.hash('TestPwd123!', 10)
  userA = await prisma.user.create({
    data: { name: 'A', email: `${PREFIX}-a@dev.local`, password: pwd },
  })
  userB = await prisma.user.create({
    data: { name: 'B', email: `${PREFIX}-b@dev.local`, password: pwd },
  })
  profileA = await createProfile({ userId: userA.id, name: 'A1' })
  profileA2 = await createProfile({ userId: userA.id, name: 'A2' })
  profileB = await createProfile({ userId: userB.id, name: 'B1' })
  accB = await createAccount({ userId: userB.id, profileId: profileB.id, name: 'BAcc' })
  cardA = await createCreditCard({
    userId: userA.id,
    profileId: profileA.id,
    name: 'CardA',
    creditLimit: 5000,
    closingDay: 5,
    dueDay: 12,
  })
  cardA2 = await createCreditCard({
    userId: userA.id,
    profileId: profileA2.id,
    name: 'CardA2',
    creditLimit: 5000,
    closingDay: 5,
    dueDay: 12,
  })
  cardB = await createCreditCard({
    userId: userB.id,
    profileId: profileB.id,
    name: 'CardB',
    creditLimit: 5000,
    closingDay: 5,
    dueDay: 12,
  })
  purchaseA = await createPurchase({
    userId: userA.id,
    profileId: profileA.id,
    cardId: cardA.id,
    date: new Date(Date.UTC(2026, 5, 10)),
    description: 'compra de A',
    totalAmount: 100,
    installments: 1,
  })
})

beforeEach(() => {
  vi.clearAllMocks()
})

afterAll(async () => {
  await prisma.user
    .deleteMany({ where: { email: { contains: PREFIX } } })
    .catch(() => {})
})

function asUser(userId: string) {
  mockGetAuthUser.mockResolvedValue({ sub: userId, email: 'x', role: 'CLIENT', name: 'x' })
}

function req(method = 'GET', body?: unknown, query?: string) {
  const url = 'http://localhost/api/test' + (query ? `?${query}` : '')
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: { 'content-type': 'application/json' },
  })
}

describe('🛡️ ISOLAMENTO multi-tenant (Fatia 2 cartão)', () => {
  test('GET cartões sem auth → 401', async () => {
    mockGetAuthUser.mockResolvedValue(null)
    const res = await getCards(req(), { params: Promise.resolve({ id: profileA.id }) })
    expect(res.status).toBe(401)
  })

  test('🚨 GET cartões userB → profileA → 404', async () => {
    asUser(userB.id)
    const res = await getCards(req(), { params: Promise.resolve({ id: profileA.id }) })
    expect(res.status).toBe(404)
  })

  test('🚨 POST cartão userB → profileA → 404 + nada criado', async () => {
    asUser(userB.id)
    const countBefore = await prisma.creditCard.count({ where: { profileId: profileA.id } })
    const res = await postCard(
      req('POST', {
        name: 'invasor',
        creditLimit: 1000,
        closingDay: 5,
        dueDay: 12,
      }),
      { params: Promise.resolve({ id: profileA.id }) },
    )
    expect(res.status).toBe(404)
    const countAfter = await prisma.creditCard.count({ where: { profileId: profileA.id } })
    expect(countAfter).toBe(countBefore)
  })

  test('🚨 GET cartão userB → cardA → 404', async () => {
    asUser(userB.id)
    const res = await getCard(req(), {
      params: Promise.resolve({ id: profileA.id, cardId: cardA.id }),
    })
    expect(res.status).toBe(404)
  })

  test('🚨 PATCH cartão userB → cardA → 404 + sem mudança', async () => {
    asUser(userB.id)
    const res = await patchCard(req('PATCH', { creditLimit: 999999 }), {
      params: Promise.resolve({ id: profileA.id, cardId: cardA.id }),
    })
    expect(res.status).toBe(404)
    const c = await prisma.creditCard.findUnique({ where: { id: cardA.id } })
    expect(c?.creditLimit).toBe(5000) // não mudou
  })

  test('🚨 DELETE cartão userB → cardA → 404 + ainda ativo', async () => {
    asUser(userB.id)
    const res = await deleteCard(req('DELETE'), {
      params: Promise.resolve({ id: profileA.id, cardId: cardA.id }),
    })
    expect(res.status).toBe(404)
    const c = await prisma.creditCard.findUnique({ where: { id: cardA.id } })
    expect(c?.isActive).toBe(true)
  })

  test('🚨 POST compra userB → cardA → 404 + nada criado', async () => {
    asUser(userB.id)
    const countBefore = await prisma.personalTransaction.count({
      where: { creditCardId: cardA.id },
    })
    const res = await postPurchase(
      req('POST', {
        date: new Date().toISOString(),
        description: 'invasor',
        totalAmount: 100,
        installments: 1,
      }),
      { params: Promise.resolve({ id: profileA.id, cardId: cardA.id }) },
    )
    expect(res.status).toBe(404)
    const countAfter = await prisma.personalTransaction.count({
      where: { creditCardId: cardA.id },
    })
    expect(countAfter).toBe(countBefore)
  })

  test('🚨 DELETE compra userB → tx de A → 404', async () => {
    asUser(userB.id)
    const tx = purchaseA.transactions[0]
    const res = await deletePurchaseEp(req('DELETE'), {
      params: Promise.resolve({ id: profileA.id, cardId: cardA.id, txId: tx.id }),
    })
    expect(res.status).toBe(404)
    const stillExists = await prisma.personalTransaction.findUnique({ where: { id: tx.id } })
    expect(stillExists).not.toBeNull()
  })

  test('🚨 POST pay userB → invoice de A com SUA conta → 404 (profile lookup falha 1º)', async () => {
    asUser(userB.id)
    const invoice = purchaseA.invoicesUpdated[0]
    const res = await postPay(
      req('POST', { paymentAccountId: accB.id, amount: 100 }),
      {
        params: Promise.resolve({
          id: profileA.id,
          cardId: cardA.id,
          invoiceId: invoice.id,
        }),
      },
    )
    expect(res.status).toBe(404)
  })

  test('🚨 cross-card: tx do cardA passada num delete-purchase do cardB → 404 (TX_NOT_FOUND)', async () => {
    asUser(userB.id)
    const tx = purchaseA.transactions[0]
    const res = await deletePurchaseEp(req('DELETE'), {
      params: Promise.resolve({ id: profileB.id, cardId: cardB.id, txId: tx.id }),
    })
    expect(res.status).toBe(404)
  })

  test('🚨 cross-perfil DO MESMO USER: compra usando categoryId de OUTRO perfil → 400', async () => {
    asUser(userA.id)
    const catsA2 = await prisma.personalCategory.findFirst({
      where: { profileId: profileA2.id, type: 'EXPENSE' },
    })
    const res = await postPurchase(
      req('POST', {
        date: new Date().toISOString(),
        description: 'cross cat',
        totalAmount: 50,
        installments: 1,
        categoryId: catsA2?.id, // categoria do OUTRO perfil
      }),
      { params: Promise.resolve({ id: profileA.id, cardId: cardA.id }) },
    )
    expect(res.status).toBe(400)
  })

  test('🚨 POST pay userA com paymentAccountId de OUTRO perfil dele → 400 INVALID_ACCOUNT', async () => {
    asUser(userA.id)
    const accA2 = await createAccount({
      userId: userA.id,
      profileId: profileA2.id,
      name: 'A2 acc',
    })
    const invoice = purchaseA.invoicesUpdated[0]
    const res = await postPay(
      req('POST', { paymentAccountId: accA2.id, amount: 50 }),
      {
        params: Promise.resolve({
          id: profileA.id,
          cardId: cardA.id,
          invoiceId: invoice.id,
        }),
      },
    )
    expect(res.status).toBe(400)
  })

  test('🚨 installments-preview userB → cardA → 404', async () => {
    asUser(userB.id)
    const res = await postPreview(
      req('POST', {
        date: new Date().toISOString(),
        totalAmount: 100,
        installments: 3,
      }),
      { params: Promise.resolve({ id: profileA.id, cardId: cardA.id }) },
    )
    expect(res.status).toBe(404)
  })

  test('listagem userA só retorna SEUS cartões', async () => {
    asUser(userA.id)
    const res = await getCards(req(), { params: Promise.resolve({ id: profileA.id }) })
    const data = await res.json()
    expect(data.cards.some((c: { id: string }) => c.id === cardA.id)).toBe(true)
    expect(data.cards.some((c: { id: string }) => c.id === cardB.id)).toBe(false)
    expect(data.cards.some((c: { id: string }) => c.id === cardA2.id)).toBe(false)
  })

  test('listagem userB só retorna cartões de profileB', async () => {
    asUser(userB.id)
    const res = await getCards(req(), { params: Promise.resolve({ id: profileB.id }) })
    const data = await res.json()
    expect(data.cards.some((c: { id: string }) => c.id === cardB.id)).toBe(true)
    expect(data.cards.some((c: { id: string }) => c.id === cardA.id)).toBe(false)
  })
})
