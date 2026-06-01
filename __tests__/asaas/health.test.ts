// Sprint Asaas FATIA 3A — testes do health check + endpoint RBAC.

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { NextRequest } from 'next/server'

const FAKE_KEY = '$aact_HEALTH_TEST_zzz'
const ENV_SANDBOX = { ASAAS_API_KEY: FAKE_KEY, ASAAS_ENV: 'sandbox' }

function mockFetch(response: { status: number; body: unknown }) {
  return vi.fn(async () => {
    return new Response(JSON.stringify(response.body), {
      status: response.status,
      headers: { 'content-type': 'application/json' },
    })
  }) as unknown as typeof fetch
}

import { checkAsaasConnection } from '@/lib/asaas/health'

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('checkAsaasConnection', () => {
  test('200 → connected=true + env + accountStatus', async () => {
    const fetchSpy = mockFetch({
      status: 200,
      body: {
        commercialInfo: { status: 'APPROVED' },
        bankAccountInfo: { status: 'APPROVED' },
      },
    })
    const r = await checkAsaasConnection({ env: ENV_SANDBOX, fetch: fetchSpy })
    expect(r.connected).toBe(true)
    if (r.connected) {
      expect(r.env).toBe('sandbox')
      expect(r.accountStatus.commercialInfo?.status).toBe('APPROVED')
    }
  })

  test('401 → connected=false + kind=auth + mensagem clara (sem expor chave)', async () => {
    const fetchSpy = mockFetch({
      status: 401,
      body: { errors: [{ description: 'Unauthorized' }] },
    })
    const r = await checkAsaasConnection({ env: ENV_SANDBOX, fetch: fetchSpy })
    expect(r.connected).toBe(false)
    if (!r.connected) {
      expect(r.error.kind).toBe('auth')
      expect(r.error.message).toMatch(/Chave inválida ou ambiente errado/)
      expect(JSON.stringify(r)).not.toContain(FAKE_KEY)
    }
  })

  test('500 do Asaas → kind=http (não auth)', async () => {
    const fetchSpy = mockFetch({
      status: 500,
      body: { errors: [{ description: 'Internal error' }] },
    })
    const r = await checkAsaasConnection({ env: ENV_SANDBOX, fetch: fetchSpy })
    expect(r.connected).toBe(false)
    if (!r.connected) {
      expect(r.error.kind).toBe('http')
    }
  })

  test('config inválida → connected=false + kind=config', async () => {
    const r = await checkAsaasConnection({ env: {}, fetch: mockFetch({ status: 200, body: {} }) })
    expect(r.connected).toBe(false)
    if (!r.connected) {
      expect(r.error.kind).toBe('config')
      expect(r.env).toBe('unknown')
    }
  })

  test('production env → URL produção', async () => {
    const fetchSpy = mockFetch({ status: 200, body: { commercialInfo: { status: 'APPROVED' } } })
    const r = await checkAsaasConnection({
      env: { ASAAS_API_KEY: FAKE_KEY, ASAAS_ENV: 'production' },
      fetch: fetchSpy,
    })
    expect(r.connected).toBe(true)
    if (r.connected) {
      expect(r.env).toBe('production')
    }
    const calls = (fetchSpy as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls
    expect(calls[0][0]).toBe('https://api.asaas.com/v3/myAccount/status')
  })
})

// =====================================================================
// Endpoint RBAC
// =====================================================================
const mockSession = vi.fn()
const mockLoadGerenciador = vi.fn()
vi.mock('@/lib/admin-auth/session', () => ({
  getAdminSession: () => mockSession(),
  loadGerenciador: (id: string) => mockLoadGerenciador(id),
}))

// Importação tardia pra pegar o mock
const { GET: getHealthRoute } = await import(
  '@/app/api/admin/asaas/health/route'
)

describe('GET /api/admin/asaas/health — RBAC', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Setup chave fake pro endpoint conseguir rodar (health vai falhar
    // por chamar Asaas real, mas vamos validar RBAC ANTES do call)
    process.env.ASAAS_API_KEY = FAKE_KEY
    process.env.ASAAS_ENV = 'sandbox'
  })

  test('sem session → 401', async () => {
    mockSession.mockResolvedValue(null)
    const res = await getHealthRoute(new NextRequest('http://localhost/test'))
    expect(res.status).toBe(401)
  })

  test('OPERADOR → 403 FORBIDDEN_RBAC', async () => {
    mockSession.mockResolvedValue({ gerenciadorId: 'g1' })
    mockLoadGerenciador.mockResolvedValue({
      id: 'g1',
      role: 'OPERADOR',
      active: true,
    })
    const res = await getHealthRoute(new NextRequest('http://localhost/test'))
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.code).toBe('FORBIDDEN_RBAC')
  })

  test('OWNER inativo → 401', async () => {
    mockSession.mockResolvedValue({ gerenciadorId: 'g1' })
    mockLoadGerenciador.mockResolvedValue({
      id: 'g1',
      role: 'OWNER',
      active: false,
    })
    const res = await getHealthRoute(new NextRequest('http://localhost/test'))
    expect(res.status).toBe(401)
  })

  test('OWNER ativo → chama health (mas não vaza chave no response)', async () => {
    mockSession.mockResolvedValue({ gerenciadorId: 'g1' })
    mockLoadGerenciador.mockResolvedValue({
      id: 'g1',
      role: 'OWNER',
      active: true,
    })
    const res = await getHealthRoute(new NextRequest('http://localhost/test'))
    // 200 retornado independente do connected (UI lê o body)
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).not.toContain(FAKE_KEY)
  })
})
