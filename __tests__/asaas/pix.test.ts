// Sprint Asaas 3B — pix lib + status mapping

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  createPixCharge,
  getPixQrCode,
  getPaymentStatus,
  isPaymentConfirmed,
  type AsaasPaymentStatus,
} from '@/lib/asaas/pix'

const FAKE_KEY = '$aact_PIX_TEST_zzz'
const ENV_SANDBOX = { ASAAS_API_KEY: FAKE_KEY, ASAAS_ENV: 'sandbox' }

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

describe('createPixCharge', () => {
  test('envia body completo com billingType:PIX', async () => {
    const fetchSpy = mockFetch({
      id: 'pay_xxx',
      customer: 'cus_x',
      billingType: 'PIX',
      value: 149.99,
      status: 'PENDING',
      dueDate: '2026-06-01',
      dateCreated: '2026-05-31',
    })
    await createPixCharge(
      {
        customer: 'cus_x',
        value: 149.99,
        dueDate: '2026-06-01',
        description: 'CAIXAOS Inteligência · 1 mês',
        externalReference: 'user:u1|plan:inteligencia|ciclo:MONTHLY|dias:30',
      },
      { env: ENV_SANDBOX, fetch: fetchSpy },
    )
    const call = (fetchSpy as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0]
    expect(call[0]).toBe('https://api-sandbox.asaas.com/v3/payments')
    const reqBody = JSON.parse(call[1].body as string)
    expect(reqBody.billingType).toBe('PIX')
    expect(reqBody.value).toBe(149.99)
    expect(reqBody.externalReference).toContain('user:u1')
  })
})

describe('getPixQrCode', () => {
  test('GET /payments/:id/pixQrCode retorna {encodedImage, payload}', async () => {
    const fetchSpy = mockFetch({
      encodedImage: 'iVBORw0KGgo...',
      payload: '00020126360014BR.GOV.BCB.PIX01...',
      expirationDate: '2026-06-01 23:59:59',
    })
    const r = await getPixQrCode('pay_xxx', { env: ENV_SANDBOX, fetch: fetchSpy })
    expect(r.encodedImage).toBeTruthy()
    expect(r.payload).toContain('BR.GOV.BCB.PIX')

    const url = (fetchSpy as unknown as { mock: { calls: [string][] } }).mock.calls[0][0]
    expect(url).toBe('https://api-sandbox.asaas.com/v3/payments/pay_xxx/pixQrCode')
  })
})

describe('getPaymentStatus', () => {
  test('GET /payments/:id retorna status', async () => {
    const fetchSpy = mockFetch({
      id: 'pay_xxx',
      customer: 'cus_x',
      billingType: 'PIX',
      value: 10,
      status: 'RECEIVED',
      dueDate: '2026-06-01',
      dateCreated: '2026-05-31',
    })
    const r = await getPaymentStatus('pay_xxx', { env: ENV_SANDBOX, fetch: fetchSpy })
    expect(r.status).toBe('RECEIVED')
  })
})

describe('isPaymentConfirmed', () => {
  test('RECEIVED → true', () => expect(isPaymentConfirmed('RECEIVED')).toBe(true))
  test('CONFIRMED → true', () => expect(isPaymentConfirmed('CONFIRMED')).toBe(true))
  test('RECEIVED_IN_CASH → true', () =>
    expect(isPaymentConfirmed('RECEIVED_IN_CASH')).toBe(true))
  test('PENDING → false', () => expect(isPaymentConfirmed('PENDING')).toBe(false))
  test('OVERDUE → false', () => expect(isPaymentConfirmed('OVERDUE')).toBe(false))
  test('REFUNDED → false (não confirmado pra fins de acesso)', () =>
    expect(isPaymentConfirmed('REFUNDED' as AsaasPaymentStatus)).toBe(false))
})
