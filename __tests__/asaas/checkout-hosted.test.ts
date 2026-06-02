// Sprint Asaas 3B — checkout-hosted lib

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  buildCheckoutHostedUrl,
  createHostedCheckout,
  getCheckoutSession,
} from '@/lib/asaas/checkout-hosted'

const FAKE_KEY = '$aact_HOSTED_zzz'
const ENV_SANDBOX = { ASAAS_API_KEY: FAKE_KEY, ASAAS_ENV: 'sandbox' }
const ENV_PROD = { ASAAS_API_KEY: FAKE_KEY, ASAAS_ENV: 'production' }

function mockFetch(body: unknown, status = 200) {
  return vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
  ) as unknown as typeof fetch
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe('createHostedCheckout', () => {
  // Sprint 3B post-fix (01/06/2026): customerData REMOVIDO do default
  // payload. O Asaas em RECURRENT exige customerData COMPLETO ou
  // NENHUM. Mantemos NENHUM e o cliente preenche tudo no hosted page.
  function buildInput(cycle: 'MONTHLY' | 'YEARLY' = 'MONTHLY') {
    return {
      items: [
        {
          name: 'CAIXAOS Inteligência (mensal)',
          description: 'IA',
          quantity: 1,
          value: 149.99,
        },
      ],
      callback: {
        successUrl: 'https://app.caixaos.com.br/assinar/sucesso',
        cancelUrl: 'https://app.caixaos.com.br/assinar?cancel=1',
        expiredUrl: 'https://app.caixaos.com.br/assinar?expired=1',
      },
      subscription: {
        cycle,
        nextDueDate: '2026-05-31',
        endDate: '2031-05-31',
      },
      externalReference: 'user:abc|plan:inteligencia|ciclo:MONTHLY',
    }
  }

  test('payload sempre tem chargeTypes:RECURRENT + billingTypes:CREDIT_CARD', async () => {
    const fetchSpy = mockFetch({ id: 'chk_001' })
    await createHostedCheckout(buildInput('MONTHLY'), {
      env: ENV_SANDBOX,
      fetch: fetchSpy,
    })
    const call = (fetchSpy as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0]
    expect(call[0]).toBe('https://api-sandbox.asaas.com/v3/checkouts')
    const reqBody = JSON.parse(call[1].body as string)
    expect(reqBody.billingTypes).toEqual(['CREDIT_CARD'])
    expect(reqBody.chargeTypes).toEqual(['RECURRENT'])
    expect(reqBody.subscription.cycle).toBe('MONTHLY')
  })

  test('ciclo YEARLY → subscription.cycle YEARLY', async () => {
    const fetchSpy = mockFetch({ id: 'chk_002' })
    await createHostedCheckout(buildInput('YEARLY'), {
      env: ENV_SANDBOX,
      fetch: fetchSpy,
    })
    const call = (fetchSpy as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0]
    const reqBody = JSON.parse(call[1].body as string)
    expect(reqBody.subscription.cycle).toBe('YEARLY')
  })

  test('🛡️ NENHUM campo de cartão no payload', async () => {
    const fetchSpy = mockFetch({ id: 'chk_003' })
    await createHostedCheckout(buildInput(), { env: ENV_SANDBOX, fetch: fetchSpy })
    const call = (fetchSpy as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0]
    const body = call[1].body as string
    expect(body).not.toMatch(/cardNumber|cvv|holderName|expiryMonth|expiryYear|creditCard/i)
  })

  test('🛡️ customerData OMITIDO por default (causa do bug "campo phone obrigatório")', async () => {
    const fetchSpy = mockFetch({ id: 'chk_no_customer' })
    await createHostedCheckout(buildInput(), { env: ENV_SANDBOX, fetch: fetchSpy })
    const call = (fetchSpy as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0]
    const reqBody = JSON.parse(call[1].body as string)
    // Asaas em RECURRENT exige customerData COMPLETO ou NENHUM —
    // enviar parcial quebra com 400. Default = NENHUM.
    expect(reqBody.customerData).toBeUndefined()
  })

  test('customerData COMPLETO é enviado quando passado explicitamente (caminho opcional)', async () => {
    const fetchSpy = mockFetch({ id: 'chk_with_customer' })
    await createHostedCheckout(
      {
        ...buildInput(),
        customerData: {
          name: 'Test',
          email: 'test@dev.local',
          cpfCnpj: '11144477735',
          phone: '11987654321',
        },
      },
      { env: ENV_SANDBOX, fetch: fetchSpy },
    )
    const call = (fetchSpy as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0]
    const reqBody = JSON.parse(call[1].body as string)
    expect(reqBody.customerData).toBeDefined()
    expect(reqBody.customerData.cpfCnpj).toBe('11144477735')
  })

  test('⚠️ externalReference SEMPRE no payload (webhook 3C precisa)', async () => {
    const fetchSpy = mockFetch({ id: 'chk_extref' })
    await createHostedCheckout(buildInput(), { env: ENV_SANDBOX, fetch: fetchSpy })
    const call = (fetchSpy as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0]
    const reqBody = JSON.parse(call[1].body as string)
    expect(reqBody.externalReference).toBe('user:abc|plan:inteligencia|ciclo:MONTHLY')
  })

  test('callback inclui 3 URLs absolutas', async () => {
    const fetchSpy = mockFetch({ id: 'chk_004' })
    await createHostedCheckout(buildInput(), { env: ENV_SANDBOX, fetch: fetchSpy })
    const call = (fetchSpy as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0]
    const reqBody = JSON.parse(call[1].body as string)
    expect(reqBody.callback.successUrl).toMatch(/^https:\/\//)
    expect(reqBody.callback.cancelUrl).toMatch(/^https:\/\//)
    expect(reqBody.callback.expiredUrl).toMatch(/^https:\/\//)
  })

  test('minutesToExpire default 30', async () => {
    const fetchSpy = mockFetch({ id: 'chk_005' })
    await createHostedCheckout(buildInput(), { env: ENV_SANDBOX, fetch: fetchSpy })
    const call = (fetchSpy as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0]
    const reqBody = JSON.parse(call[1].body as string)
    expect(reqBody.minutesToExpire).toBe(30)
  })
})

describe('buildCheckoutHostedUrl', () => {
  test('sandbox usa sandbox.asaas.com', () => {
    expect(buildCheckoutHostedUrl('sandbox', 'chk_001')).toBe(
      'https://sandbox.asaas.com/checkoutSession/show?id=chk_001',
    )
  })
  test('production usa www.asaas.com', () => {
    expect(buildCheckoutHostedUrl('production', 'chk_001')).toBe(
      'https://www.asaas.com/checkoutSession/show?id=chk_001',
    )
  })
  test('encoda id com chars especiais', () => {
    const u = buildCheckoutHostedUrl('sandbox', 'chk/with spaces')
    expect(u).toContain('chk%2Fwith%20spaces')
  })
})

describe('getCheckoutSession', () => {
  test('GET /checkouts/:id retorna status + subscription', async () => {
    const fetchSpy = mockFetch({
      id: 'chk_001',
      status: 'PAID',
      subscription: { id: 'sub_abc' },
    })
    const r = await getCheckoutSession('chk_001', {
      env: ENV_SANDBOX,
      fetch: fetchSpy,
    })
    expect(r.status).toBe('PAID')
    expect(r.subscription?.id).toBe('sub_abc')
  })

  test('production retorna URL diferente', async () => {
    const fetchSpy = mockFetch({ id: 'chk_p', status: 'PAID' })
    await getCheckoutSession('chk_p', { env: ENV_PROD, fetch: fetchSpy })
    const url = (fetchSpy as unknown as { mock: { calls: [string][] } }).mock.calls[0][0]
    expect(url).toBe('https://api.asaas.com/v3/checkouts/chk_p')
  })
})
