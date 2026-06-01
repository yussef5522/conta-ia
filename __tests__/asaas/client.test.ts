// Sprint Asaas FATIA 3A — testes do cliente HTTP.
// 🛡️ Foco principal: SANITIZAÇÃO DE LOGS (regra não-negociável).

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
  type MockInstance,
} from 'vitest'
import { asaasRequest } from '@/lib/asaas/client'
import {
  AsaasApiError,
  AsaasConfigError,
  AsaasNetworkError,
} from '@/lib/asaas/errors'

const FAKE_KEY = '$aact_TESTING_KEY_DO_NOT_LEAK_zZzZ123'
const ENV_SANDBOX = { ASAAS_API_KEY: FAKE_KEY, ASAAS_ENV: 'sandbox' }
const ENV_PROD = { ASAAS_API_KEY: FAKE_KEY, ASAAS_ENV: 'production' }

function mockFetch(response: { status: number; body?: unknown; text?: string }) {
  return vi.fn(async () => {
    const text = response.text ?? (response.body !== undefined ? JSON.stringify(response.body) : '')
    return new Response(text, {
      status: response.status,
      headers: { 'content-type': 'application/json' },
    })
  }) as unknown as typeof fetch
}

let consoleSpy: MockInstance

beforeEach(() => {
  consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  consoleSpy.mockRestore()
})

describe('asaasRequest — request shape', () => {
  test('inclui header access_token (não Bearer)', async () => {
    const fetchSpy = vi.fn(
      async () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
    ) as unknown as typeof fetch
    await asaasRequest('/myAccount/status', {}, { env: ENV_SANDBOX, fetch: fetchSpy })

    const callArgs = (fetchSpy as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]
    const init = callArgs[1] as RequestInit
    const headers = init.headers as Record<string, string>
    expect(headers.access_token).toBe(FAKE_KEY)
    expect(headers['authorization']).toBeUndefined()
  })

  test('URL sandbox quando ASAAS_ENV=sandbox', async () => {
    const fetchSpy = mockFetch({ status: 200, body: {} })
    await asaasRequest('/customers', {}, { env: ENV_SANDBOX, fetch: fetchSpy })
    const url = (fetchSpy as unknown as { mock: { calls: [string, ...unknown[]][] } }).mock.calls[0][0]
    expect(url).toBe('https://api-sandbox.asaas.com/v3/customers')
  })

  test('URL produção quando ASAAS_ENV=production', async () => {
    const fetchSpy = mockFetch({ status: 200, body: {} })
    await asaasRequest('/customers', {}, { env: ENV_PROD, fetch: fetchSpy })
    const url = (fetchSpy as unknown as { mock: { calls: [string, ...unknown[]][] } }).mock.calls[0][0]
    expect(url).toBe('https://api.asaas.com/v3/customers')
  })

  test('POST inclui body JSON + content-type', async () => {
    const fetchSpy = mockFetch({ status: 200, body: {} })
    await asaasRequest(
      '/customers',
      { method: 'POST', body: { name: 'X', cpfCnpj: '11111111111' } },
      { env: ENV_SANDBOX, fetch: fetchSpy },
    )
    const call = (fetchSpy as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0]
    const init = call[1]
    expect(init.method).toBe('POST')
    expect(init.body).toBe('{"name":"X","cpfCnpj":"11111111111"}')
    expect((init.headers as Record<string, string>)['content-type']).toBe('application/json')
  })

  test('rejeita path sem /', async () => {
    const fetchSpy = mockFetch({ status: 200, body: {} })
    await expect(
      asaasRequest('customers', {}, { env: ENV_SANDBOX, fetch: fetchSpy }),
    ).rejects.toThrow(/deve começar com/)
  })
})

describe('asaasRequest — config errors', () => {
  test('chave ausente → AsaasConfigError', async () => {
    await expect(
      asaasRequest('/customers', {}, { env: {}, fetch: mockFetch({ status: 200 }) }),
    ).rejects.toThrow(AsaasConfigError)
  })
})

describe('asaasRequest — erros do Asaas', () => {
  test('400 com errors[] → AsaasApiError com firstErrorDescription', async () => {
    const fetchSpy = mockFetch({
      status: 400,
      body: {
        errors: [{ code: 'invalid_cpfCnpj', description: 'CPF/CNPJ inválido' }],
      },
    })
    let err: AsaasApiError | null = null
    try {
      await asaasRequest('/customers', { method: 'POST', body: {} }, { env: ENV_SANDBOX, fetch: fetchSpy })
    } catch (e) {
      err = e as AsaasApiError
    }
    expect(err).toBeInstanceOf(AsaasApiError)
    expect(err!.statusCode).toBe(400)
    expect(err!.firstErrorDescription()).toBe('CPF/CNPJ inválido')
    expect(err!.path).toBe('/customers')
  })

  test('401 sem errors[] → fallback genérico', async () => {
    const fetchSpy = mockFetch({ status: 401, body: {} })
    let err: AsaasApiError | null = null
    try {
      await asaasRequest('/myAccount/status', {}, { env: ENV_SANDBOX, fetch: fetchSpy })
    } catch (e) {
      err = e as AsaasApiError
    }
    expect(err!.statusCode).toBe(401)
    expect(err!.firstErrorDescription()).toMatch(/Erro 401/)
  })

  test('resposta não-JSON não quebra (parsed=null)', async () => {
    const fetchSpy = mockFetch({ status: 500, text: '<html>oops</html>' })
    let err: AsaasApiError | null = null
    try {
      await asaasRequest('/customers', {}, { env: ENV_SANDBOX, fetch: fetchSpy })
    } catch (e) {
      err = e as AsaasApiError
    }
    expect(err).toBeInstanceOf(AsaasApiError)
    expect(err!.body).toBeNull()
  })
})

describe('asaasRequest — erros de rede', () => {
  test('fetch throw → AsaasNetworkError sem expor message bruto', async () => {
    const fetchSpy = vi.fn(async () => {
      throw new Error('ECONNREFUSED https://api-sandbox.asaas.com (poderia conter token em URL malformada)')
    }) as unknown as typeof fetch

    let err: AsaasNetworkError | null = null
    try {
      await asaasRequest('/customers', {}, { env: ENV_SANDBOX, fetch: fetchSpy })
    } catch (e) {
      err = e as AsaasNetworkError
    }
    expect(err).toBeInstanceOf(AsaasNetworkError)
    expect(err!.message).toBe('Falha de rede ao chamar Asaas')
    // ⚠️ Garantia: mensagem do throw original NÃO vaza
    expect(err!.message).not.toContain('ECONNREFUSED')
  })

  test('AbortError → mensagem "Timeout"', async () => {
    const fetchSpy = vi.fn(async () => {
      const e = new Error('aborted')
      e.name = 'AbortError'
      throw e
    }) as unknown as typeof fetch

    let err: AsaasNetworkError | null = null
    try {
      await asaasRequest('/customers', { timeoutMs: 10 }, { env: ENV_SANDBOX, fetch: fetchSpy })
    } catch (e) {
      err = e as AsaasNetworkError
    }
    expect(err!.message).toBe('Timeout ao chamar Asaas')
  })
})

// =====================================================================
// 🛡️ TESTES CRÍTICOS DE SEGURANÇA — não-negociáveis
// =====================================================================
describe('🛡️ Sanitização de logs — A chave NUNCA aparece em log/erro', () => {
  test('console.error NÃO contém a apiKey em erro HTTP 401', async () => {
    const fetchSpy = mockFetch({
      status: 401,
      body: { errors: [{ code: 'invalid_token', description: 'Invalid' }] },
    })
    try {
      await asaasRequest('/customers', {}, { env: ENV_SANDBOX, fetch: fetchSpy })
    } catch {
      // ignored
    }
    const allLogs = consoleSpy.mock.calls
      .map((args) => JSON.stringify(args))
      .join('\n')
    expect(allLogs).not.toContain(FAKE_KEY)
  })

  test('console.error NÃO contém a apiKey em erro de rede', async () => {
    const fetchSpy = vi.fn(async () => {
      throw new Error(`Connection failed to https://api-sandbox.asaas.com?token=${FAKE_KEY}`)
    }) as unknown as typeof fetch
    try {
      await asaasRequest('/customers', {}, { env: ENV_SANDBOX, fetch: fetchSpy })
    } catch {
      // ignored
    }
    const allLogs = consoleSpy.mock.calls
      .map((args) => JSON.stringify(args))
      .join('\n')
    expect(allLogs).not.toContain(FAKE_KEY)
  })

  test('AsaasApiError lançado NÃO carrega apiKey em message/stack/body', async () => {
    const fetchSpy = mockFetch({
      status: 422,
      body: { errors: [{ code: 'x', description: 'X' }] },
    })
    let err: AsaasApiError | null = null
    try {
      await asaasRequest('/customers', { method: 'POST', body: { name: 'X' } }, { env: ENV_SANDBOX, fetch: fetchSpy })
    } catch (e) {
      err = e as AsaasApiError
    }
    const errSerialized = JSON.stringify({
      message: err!.message,
      stack: err!.stack,
      body: err!.body,
      path: err!.path,
    })
    expect(errSerialized).not.toContain(FAKE_KEY)
  })

  test('console.error NÃO contém o header access_token (mesmo em erro)', async () => {
    const fetchSpy = mockFetch({ status: 500, body: { errors: [{ description: 'oops' }] } })
    try {
      await asaasRequest('/customers', {}, { env: ENV_SANDBOX, fetch: fetchSpy })
    } catch {
      // ignored
    }
    const allLogs = consoleSpy.mock.calls
      .map((args) => JSON.stringify(args))
      .join('\n')
    expect(allLogs.toLowerCase()).not.toContain('access_token')
  })

  test('Resposta não-JSON 500 com body que CONTÉM a chave: log NÃO inclui o body bruto', async () => {
    // Caso hipotético: o Asaas (ou um proxy/CDN intermediário) ecoa headers no body.
    // Nosso wrapper NUNCA pode logar o text bruto.
    const fetchSpy = mockFetch({
      status: 500,
      text: `<html>Internal error. Request headers: access_token=${FAKE_KEY}</html>`,
    })
    try {
      await asaasRequest('/customers', {}, { env: ENV_SANDBOX, fetch: fetchSpy })
    } catch {
      // ignored
    }
    const allLogs = consoleSpy.mock.calls
      .map((args) => JSON.stringify(args))
      .join('\n')
    expect(allLogs).not.toContain(FAKE_KEY)
  })
})
