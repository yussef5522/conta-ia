// BrasilAPI client (com fetch mockado) — Fase 3 Etapa 2.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchCNPJ,
  unblockBrasilApi,
  isBrasilApiBlocked,
} from '@/lib/ai-categorizer/brasilapi-client'

const VALID_CNPJ = '11222333000181'

function mockResponse(status: number, body?: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: () => Promise.resolve(body ?? {}),
  } as unknown as Response
}

beforeEach(() => {
  unblockBrasilApi()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('fetchCNPJ — success', () => {
  it('retorna { kind: success, data } no 200 com razao_social', async () => {
    const fakeData = {
      cnpj: VALID_CNPJ,
      razao_social: 'VIVO TELECOMUNICACOES LTDA',
      nome_fantasia: 'Vivo',
      cnae_fiscal: 6110801,
      cnae_fiscal_descricao: 'Telefonia móvel',
      situacao_cadastral: 2,
    }
    const fetcher = vi.fn().mockResolvedValue(mockResponse(200, fakeData))
    const result = await fetchCNPJ(VALID_CNPJ, { fetcher })
    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(result.data.razao_social).toBe('VIVO TELECOMUNICACOES LTDA')
      expect(result.data.cnae_fiscal).toBe(6110801)
    }
  })
})

describe('fetchCNPJ — erros graceful', () => {
  it('404 → not-found', async () => {
    const fetcher = vi.fn().mockResolvedValue(mockResponse(404))
    const result = await fetchCNPJ(VALID_CNPJ, { fetcher })
    expect(result.kind).toBe('not-found')
  })

  it('429 → rate-limited E bloqueia BrasilAPI por 60s', async () => {
    const fetcher = vi.fn().mockResolvedValue(mockResponse(429))
    const result = await fetchCNPJ(VALID_CNPJ, { fetcher })
    expect(result.kind).toBe('rate-limited')
    expect(isBrasilApiBlocked()).toBe(true)
  })

  it('500 → error', async () => {
    const fetcher = vi.fn().mockResolvedValue(mockResponse(500))
    const result = await fetchCNPJ(VALID_CNPJ, { fetcher })
    expect(result.kind).toBe('error')
    if (result.kind === 'error') {
      expect(result.status).toBe(500)
    }
  })

  it('timeout (AbortError) → timeout', async () => {
    const fetcher = vi.fn().mockImplementation(() => {
      const err = new Error('aborted')
      err.name = 'AbortError'
      return Promise.reject(err)
    })
    const result = await fetchCNPJ(VALID_CNPJ, { fetcher })
    expect(result.kind).toBe('timeout')
  })

  it('200 sem razao_social → error', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(mockResponse(200, { cnpj: VALID_CNPJ }))
    const result = await fetchCNPJ(VALID_CNPJ, { fetcher })
    expect(result.kind).toBe('error')
  })
})

describe('fetchCNPJ — rate-limit guard em memória', () => {
  it('chamada seguinte após 429 retorna rate-limited sem fazer fetch', async () => {
    const fetcher1 = vi.fn().mockResolvedValue(mockResponse(429))
    await fetchCNPJ(VALID_CNPJ, { fetcher: fetcher1 })
    expect(isBrasilApiBlocked()).toBe(true)

    const fetcher2 = vi.fn() // NÃO deve ser chamado
    const result = await fetchCNPJ(VALID_CNPJ, { fetcher: fetcher2 })
    expect(result.kind).toBe('rate-limited')
    expect(fetcher2).not.toHaveBeenCalled()
  })

  it('forceBypassRateLimit ignora o guard', async () => {
    const fetcher1 = vi.fn().mockResolvedValue(mockResponse(429))
    await fetchCNPJ(VALID_CNPJ, { fetcher: fetcher1 })

    const fetcher2 = vi.fn().mockResolvedValue(
      mockResponse(200, { razao_social: 'TESTE LTDA' }),
    )
    const result = await fetchCNPJ(VALID_CNPJ, {
      fetcher: fetcher2,
      forceBypassRateLimit: true,
    })
    expect(result.kind).toBe('success')
    expect(fetcher2).toHaveBeenCalled()
  })
})

describe('fetchCNPJ — validação de input', () => {
  it('CNPJ com tamanho errado → error', async () => {
    const fetcher = vi.fn()
    const result = await fetchCNPJ('123', { fetcher })
    expect(result.kind).toBe('error')
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('CNPJ com pontuação é normalizado pra 14 dígitos antes do fetch', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      mockResponse(200, { razao_social: 'TESTE LTDA' }),
    )
    await fetchCNPJ('11.222.333/0001-81', { fetcher })
    const calledUrl = fetcher.mock.calls[0][0] as string
    expect(calledUrl).toContain('11222333000181')
    // CNPJ na URL não pode ter pontuação (a base url tem '.' do domain)
    const cnpjPath = calledUrl.split('/').pop() ?? ''
    expect(cnpjPath).not.toContain('.')
    expect(cnpjPath).toBe('11222333000181')
  })
})
