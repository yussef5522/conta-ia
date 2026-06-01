// Sprint Asaas FATIA 3A — testes createOrGetCustomerForUser.

import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { createOrGetCustomerForUser } from '@/lib/asaas/customers'
import { createTrialSubscription } from '@/lib/subscription/create-trial'

const FAKE_KEY = '$aact_TEST_KEY_zzzzzzzzz'
const ENV_SANDBOX = { ASAAS_API_KEY: FAKE_KEY, ASAAS_ENV: 'sandbox' }

const TEST_PREFIX = `asaas-cust-${Date.now()}-${process.pid}`
const createdUserIds: string[] = []

async function makeUserWithSub(suffix: string) {
  const u = await prisma.user.create({
    data: {
      name: `Cust ${suffix}`,
      email: `${TEST_PREFIX}-${suffix}@t.dev`,
      password: await bcrypt.hash('Senha123!', 10),
    },
  })
  createdUserIds.push(u.id)
  await createTrialSubscription(prisma, { userId: u.id })
  return u
}

function mockFetchSeq(responses: Array<{ status: number; body: unknown }>) {
  let i = 0
  return vi.fn(async () => {
    const r = responses[i] ?? responses[responses.length - 1]
    i++
    return new Response(JSON.stringify(r.body), {
      status: r.status,
      headers: { 'content-type': 'application/json' },
    })
  }) as unknown as typeof fetch
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterAll(async () => {
  await prisma.user
    .deleteMany({ where: { email: { contains: TEST_PREFIX } } })
    .catch(() => {})
})

describe('createOrGetCustomerForUser', () => {
  test('cria customer novo + salva gatewayCustomerId + retorna created=true', async () => {
    const u = await makeUserWithSub('new')
    const fetchSpy = mockFetchSeq([
      {
        status: 200,
        body: {
          id: 'cus_000001',
          name: u.name,
          email: u.email,
          cpfCnpj: '11144477735',
          externalReference: u.id,
          dateCreated: '2026-05-31',
        },
      },
    ])

    const result = await createOrGetCustomerForUser(
      {
        userId: u.id,
        name: u.name,
        email: u.email,
        cpfCnpj: '11144477735',
      },
      { env: ENV_SANDBOX, fetch: fetchSpy },
    )

    expect(result.created).toBe(true)
    expect(result.customer.id).toBe('cus_000001')

    // gatewayCustomerId persistido
    const sub = await prisma.subscription.findUnique({ where: { userId: u.id } })
    expect(sub?.gatewayCustomerId).toBe('cus_000001')

    // POST foi pra /customers com externalReference=userId
    const calls = (fetchSpy as unknown as {
      mock: { calls: [string, RequestInit][] }
    }).mock.calls
    expect(calls[0][0]).toBe('https://api-sandbox.asaas.com/v3/customers')
    const reqBody = JSON.parse(calls[0][1].body as string)
    expect(reqBody.externalReference).toBe(u.id)
    expect(reqBody.cpfCnpj).toBe('11144477735')
  })

  test('idempotente: 2ª chamada retorna existing (GET, NÃO cria de novo)', async () => {
    const u = await makeUserWithSub('idem')

    // 1ª chamada: cria
    const createFetch = mockFetchSeq([
      {
        status: 200,
        body: {
          id: 'cus_idem_001',
          name: u.name,
          email: u.email,
          cpfCnpj: '11144477735',
          externalReference: u.id,
          dateCreated: '2026-05-31',
        },
      },
    ])
    await createOrGetCustomerForUser(
      {
        userId: u.id,
        name: u.name,
        email: u.email,
        cpfCnpj: '11144477735',
      },
      { env: ENV_SANDBOX, fetch: createFetch },
    )

    // 2ª chamada: deve fazer GET /customers/cus_idem_001 (não POST)
    const getFetch = mockFetchSeq([
      {
        status: 200,
        body: {
          id: 'cus_idem_001',
          name: u.name,
          email: u.email,
          cpfCnpj: '11144477735',
          externalReference: u.id,
          dateCreated: '2026-05-31',
        },
      },
    ])
    const result = await createOrGetCustomerForUser(
      {
        userId: u.id,
        name: u.name,
        email: u.email,
        cpfCnpj: '11144477735',
      },
      { env: ENV_SANDBOX, fetch: getFetch },
    )

    expect(result.created).toBe(false)
    expect(result.customer.id).toBe('cus_idem_001')

    const calls = (getFetch as unknown as {
      mock: { calls: [string, RequestInit][] }
    }).mock.calls
    expect(calls[0][0]).toBe(
      'https://api-sandbox.asaas.com/v3/customers/cus_idem_001',
    )
    expect(calls[0][1].method).toBe('GET')
  })

  test('throw se user não tem Subscription', async () => {
    const u = await prisma.user.create({
      data: {
        name: 'Sem Sub',
        email: `${TEST_PREFIX}-nosub@t.dev`,
        password: 'hash',
      },
    })
    createdUserIds.push(u.id)

    await expect(
      createOrGetCustomerForUser(
        {
          userId: u.id,
          name: u.name,
          email: u.email,
          cpfCnpj: '11144477735',
        },
        { env: ENV_SANDBOX, fetch: mockFetchSeq([{ status: 200, body: {} }]) },
      ),
    ).rejects.toThrow(/não tem Subscription/)
  })
})
