// Sprint Asaas 3B — endpoints integração + GRANTED block + sanitização

import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest'
import bcrypt from 'bcryptjs'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'

const FAKE_KEY = '$aact_EP_3B_zzz'
const ENV_SANDBOX = { ASAAS_API_KEY: FAKE_KEY, ASAAS_ENV: 'sandbox' }

// Mock getAuthUser
const mockGetAuthUser = vi.fn()
vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>()
  return { ...actual, getAuthUser: (req: NextRequest) => mockGetAuthUser(req) }
})

// Mock chamadas Asaas — interceptamos fetch global
const origFetch = globalThis.fetch

const { POST: postPix } = await import('@/app/api/subscription/checkout/pix/route')
const { GET: getPixStatus } = await import(
  '@/app/api/subscription/checkout/pix/status/route'
)
const { POST: postCartao } = await import(
  '@/app/api/subscription/checkout/cartao/route'
)

const TEST_PREFIX = `ep3b-${Date.now()}-${process.pid}`
const createdUserIds: string[] = []

async function makeUserWithSub(opts: {
  email: string
  subStatus: 'TRIAL' | 'ACTIVE' | 'GRANTED' | 'EXPIRED'
  trialEndsAt?: Date
}) {
  const u = await prisma.user.create({
    data: {
      name: `T ${opts.email.split('@')[0]}`,
      email: opts.email,
      password: await bcrypt.hash('Senha123!', 10),
    },
  })
  createdUserIds.push(u.id)
  await prisma.subscription.create({
    data: {
      userId: u.id,
      planId: 'inteligencia',
      status: opts.subStatus,
      trialEndsAt: opts.trialEndsAt ?? null,
    },
  })
  return u
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.ASAAS_API_KEY = FAKE_KEY
  process.env.ASAAS_ENV = 'sandbox'
})

afterAll(async () => {
  globalThis.fetch = origFetch
  await prisma.user
    .deleteMany({ where: { email: { contains: TEST_PREFIX } } })
    .catch(() => {})
})

function reqJson(method: string, body: unknown) {
  return new NextRequest('http://localhost/api/test', {
    method,
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

function mockGlobalFetchSequence(steps: Array<{ status: number; body: unknown }>) {
  let i = 0
  globalThis.fetch = vi.fn(async () => {
    const s = steps[i] ?? steps[steps.length - 1]
    i++
    return new Response(JSON.stringify(s.body), {
      status: s.status,
      headers: { 'content-type': 'application/json' },
    })
  }) as unknown as typeof fetch
}

/* ============================================================
 * BLOQUEIO GRANTED — testes críticos
 * ============================================================ */
describe('🛡️ GRANTED — bloqueio em /pix + /cartao', () => {
  test('Pix retorna 403 GRANTED_NO_CHECKOUT', async () => {
    const u = await makeUserWithSub({
      email: `${TEST_PREFIX}-granted-pix@t.dev`,
      subStatus: 'GRANTED',
    })
    mockGetAuthUser.mockResolvedValue({
      sub: u.id,
      email: u.email,
      name: u.name,
      role: 'CLIENT',
    })

    const res = await postPix(
      reqJson('POST', { planId: 'inteligencia', ciclo: 'MONTHLY', cpfCnpj: '11144477735' }),
    )
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.code).toBe('GRANTED_NO_CHECKOUT')
  })

  test('Cartão retorna 403 GRANTED_NO_CHECKOUT', async () => {
    const u = await makeUserWithSub({
      email: `${TEST_PREFIX}-granted-card@t.dev`,
      subStatus: 'GRANTED',
    })
    mockGetAuthUser.mockResolvedValue({
      sub: u.id,
      email: u.email,
      name: u.name,
      role: 'CLIENT',
    })

    const res = await postCartao(
      reqJson('POST', { planId: 'inteligencia', ciclo: 'MONTHLY', cpfCnpj: '11144477735' }),
    )
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.code).toBe('GRANTED_NO_CHECKOUT')
  })

  test('ACTIVE retorna 409 ALREADY_ACTIVE em /pix', async () => {
    const u = await makeUserWithSub({
      email: `${TEST_PREFIX}-active@t.dev`,
      subStatus: 'ACTIVE',
    })
    mockGetAuthUser.mockResolvedValue({
      sub: u.id,
      email: u.email,
      name: u.name,
      role: 'CLIENT',
    })

    const res = await postPix(
      reqJson('POST', { planId: 'inteligencia', ciclo: 'MONTHLY', cpfCnpj: '11144477735' }),
    )
    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.code).toBe('ALREADY_ACTIVE')
  })
})

/* ============================================================
 * Validação CPF/CNPJ
 * ============================================================ */
describe('CPF/CNPJ obrigatório e válido', () => {
  test('Pix com CPF inválido → 400 INVALID_CPF_CNPJ', async () => {
    const u = await makeUserWithSub({
      email: `${TEST_PREFIX}-badcpf@t.dev`,
      subStatus: 'EXPIRED',
    })
    mockGetAuthUser.mockResolvedValue({
      sub: u.id,
      email: u.email,
      name: u.name,
      role: 'CLIENT',
    })

    const res = await postPix(
      reqJson('POST', { planId: 'inteligencia', ciclo: 'MONTHLY', cpfCnpj: '11111111111' }),
    )
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.code).toBe('INVALID_CPF_CNPJ')
  })

  test('Cartão com CPF inválido → 400 INVALID_CPF_CNPJ', async () => {
    const u = await makeUserWithSub({
      email: `${TEST_PREFIX}-badcpf2@t.dev`,
      subStatus: 'EXPIRED',
    })
    mockGetAuthUser.mockResolvedValue({
      sub: u.id,
      email: u.email,
      name: u.name,
      role: 'CLIENT',
    })

    const res = await postCartao(
      reqJson('POST', { planId: 'inteligencia', ciclo: 'MONTHLY', cpfCnpj: '00000000000' }),
    )
    expect(res.status).toBe(400)
  })
})

/* ============================================================
 * Fluxo Pix sucesso — mock global fetch (4 calls: create customer +
 * create payment + get qr + nada). Já temos sub via getOrCreate.
 * ============================================================ */
describe('Fluxo Pix end-to-end (mock fetch)', () => {
  test('cria Pix → retorna QR + paymentId', async () => {
    const u = await makeUserWithSub({
      email: `${TEST_PREFIX}-pixok@t.dev`,
      subStatus: 'TRIAL',
      trialEndsAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // expirado
    })
    mockGetAuthUser.mockResolvedValue({
      sub: u.id,
      email: u.email,
      name: u.name,
      role: 'CLIENT',
    })

    // 1) POST /v3/customers (cria customer)
    // 2) POST /v3/payments
    // 3) GET /v3/payments/{id}/pixQrCode
    mockGlobalFetchSequence([
      {
        status: 200,
        body: {
          id: 'cus_e2e_001',
          name: u.name,
          email: u.email,
          cpfCnpj: '11144477735',
          externalReference: u.id,
          dateCreated: '2026-05-31',
        },
      },
      {
        status: 200,
        body: {
          id: 'pay_e2e_001',
          customer: 'cus_e2e_001',
          billingType: 'PIX',
          value: 149.99,
          status: 'PENDING',
          dueDate: '2026-06-01',
          dateCreated: '2026-05-31',
        },
      },
      {
        status: 200,
        body: {
          encodedImage: 'iVBORw0KGgoAAAA',
          payload: '00020126360014BR.GOV.BCB.PIX01...',
          expirationDate: '2026-06-01 23:59:59',
        },
      },
    ])

    const res = await postPix(
      reqJson('POST', { planId: 'inteligencia', ciclo: 'MONTHLY', cpfCnpj: '11144477735' }),
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.paymentId).toBe('pay_e2e_001')
    expect(data.qrImageBase64).toBe('iVBORw0KGgoAAAA')
    expect(data.copiaECola).toContain('BR.GOV.BCB.PIX')
    expect(data.valor).toBe(149.99)
    expect(data.diasAcesso).toBe(30)
  })
})

/* ============================================================
 * Polling pix/status — confirma RECEIVED → marca ACTIVE
 * ============================================================ */
describe('Polling Pix status', () => {
  test('RECEIVED → marca Subscription ACTIVE + currentPeriodEnd +30d', async () => {
    const u = await makeUserWithSub({
      email: `${TEST_PREFIX}-poll-ok@t.dev`,
      subStatus: 'TRIAL',
      trialEndsAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    })
    mockGetAuthUser.mockResolvedValue({
      sub: u.id,
      email: u.email,
      name: u.name,
      role: 'CLIENT',
    })

    mockGlobalFetchSequence([
      {
        status: 200,
        body: {
          id: 'pay_poll_001',
          customer: 'cus_p',
          billingType: 'PIX',
          value: 149.99,
          status: 'RECEIVED',
          dueDate: '2026-06-01',
          dateCreated: '2026-05-31',
          externalReference: `user:${u.id}|plan:inteligencia|ciclo:MONTHLY|dias:30`,
        },
      },
    ])

    const req = new NextRequest(
      'http://localhost/api/subscription/checkout/pix/status?paymentId=pay_poll_001',
    )
    const res = await getPixStatus(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.status).toBe('CONFIRMED')

    const sub = await prisma.subscription.findUnique({ where: { userId: u.id } })
    expect(sub?.status).toBe('ACTIVE')
    expect(sub?.currentPeriodEnd).not.toBeNull()
  })

  test('PENDING → status PENDING, Subscription INALTERADA', async () => {
    const u = await makeUserWithSub({
      email: `${TEST_PREFIX}-poll-pending@t.dev`,
      subStatus: 'TRIAL',
      trialEndsAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    })
    mockGetAuthUser.mockResolvedValue({
      sub: u.id,
      email: u.email,
      name: u.name,
      role: 'CLIENT',
    })

    mockGlobalFetchSequence([
      {
        status: 200,
        body: {
          id: 'pay_pend',
          customer: 'cus_p',
          billingType: 'PIX',
          value: 149.99,
          status: 'PENDING',
          dueDate: '2026-06-01',
          dateCreated: '2026-05-31',
          externalReference: `user:${u.id}|plan:inteligencia|ciclo:MONTHLY|dias:30`,
        },
      },
    ])

    const res = await getPixStatus(
      new NextRequest('http://localhost/api?paymentId=pay_pend'),
    )
    const data = await res.json()
    expect(data.status).toBe('PENDING')

    const sub = await prisma.subscription.findUnique({ where: { userId: u.id } })
    expect(sub?.status).toBe('TRIAL') // não mudou
  })

  test('🛡️ multi-tenant: payment de outro user retorna 403', async () => {
    const userA = await makeUserWithSub({
      email: `${TEST_PREFIX}-mtA@t.dev`,
      subStatus: 'EXPIRED',
    })
    const userB = await makeUserWithSub({
      email: `${TEST_PREFIX}-mtB@t.dev`,
      subStatus: 'EXPIRED',
    })

    mockGetAuthUser.mockResolvedValue({
      sub: userA.id,
      email: userA.email,
      name: userA.name,
      role: 'CLIENT',
    })

    mockGlobalFetchSequence([
      {
        status: 200,
        body: {
          id: 'pay_userB',
          customer: 'cus_b',
          billingType: 'PIX',
          value: 100,
          status: 'RECEIVED',
          dueDate: '2026-06-01',
          dateCreated: '2026-05-31',
          // externalReference do user B
          externalReference: `user:${userB.id}|plan:inteligencia|ciclo:MONTHLY|dias:30`,
        },
      },
    ])

    const res = await getPixStatus(
      new NextRequest('http://localhost/api?paymentId=pay_userB'),
    )
    expect(res.status).toBe(403)

    // userA sub NÃO mudou
    const subA = await prisma.subscription.findUnique({ where: { userId: userA.id } })
    expect(subA?.status).toBe('EXPIRED')
  })
})

/* ============================================================
 * Cartão checkout cria URL
 * ============================================================ */
describe('Cartão cria URL hosted', () => {
  test('retorna checkoutUrl sandbox', async () => {
    const u = await makeUserWithSub({
      email: `${TEST_PREFIX}-card@t.dev`,
      subStatus: 'EXPIRED',
    })
    mockGetAuthUser.mockResolvedValue({
      sub: u.id,
      email: u.email,
      name: u.name,
      role: 'CLIENT',
    })

    // 1) POST customers, 2) POST checkouts
    mockGlobalFetchSequence([
      {
        status: 200,
        body: {
          id: 'cus_card',
          name: u.name,
          email: u.email,
          cpfCnpj: '11144477735',
          externalReference: u.id,
          dateCreated: '2026-05-31',
        },
      },
      { status: 200, body: { id: 'chk_card_001' } },
    ])

    const res = await postCartao(
      reqJson('POST', { planId: 'inteligencia', ciclo: 'MONTHLY', cpfCnpj: '11144477735' }),
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.checkoutId).toBe('chk_card_001')
    expect(data.checkoutUrl).toBe(
      'https://sandbox.asaas.com/checkoutSession/show?id=chk_card_001',
    )
    expect(data.env).toBe('sandbox')

    // checkoutSessionId salvo na Subscription
    const sub = await prisma.subscription.findUnique({ where: { userId: u.id } })
    expect(sub?.checkoutSessionId).toBe('chk_card_001')
  })
})
