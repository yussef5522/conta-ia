// Claude client (fetch mockado) — Fase 3 Etapa 3.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  callClaude,
  computeCostCents,
  isClaudeEnabled,
  parseSuggestionJSON,
} from '@/lib/ai-categorizer/claude-client'

function mockResponse(status: number, body?: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: () => Promise.resolve(body ?? {}),
  } as unknown as Response
}

const baseInput = {
  tradeName: 'cacula mix',
  companyType: 'mixed',
  categories: [{ id: 'c1', name: 'Vendas', dreGroup: 'RECEITA_BRUTA' }],
  fewShot: [],
  description: 'PIX ENVIADO',
  amount: 500,
  type: 'DEBIT' as const,
  date: new Date('2026-05-15T12:00:00Z'),
}

beforeEach(() => {
  // Sandbox env por teste — não vazar pra outros
})

describe('parseSuggestionJSON — robustness', () => {
  it('parseia JSON puro válido', () => {
    const r = parseSuggestionJSON(
      '{"categoryId":"c1","confidence":0.85,"reasoning":"OK","alternativeCategoryIds":[]}',
    )
    expect(r?.categoryId).toBe('c1')
    expect(r?.confidence).toBe(0.85)
  })

  it('extrai JSON dentro de markdown ```json```', () => {
    const r = parseSuggestionJSON(
      '```json\n{"categoryId":"c1","confidence":0.9,"reasoning":"ok","alternativeCategoryIds":[]}\n```',
    )
    expect(r?.categoryId).toBe('c1')
  })

  it('extrai JSON depois de texto introdutório (Claude desobedeceu prompt)', () => {
    const r = parseSuggestionJSON(
      'Aqui está: {"categoryId":"c1","confidence":0.7,"reasoning":"x","alternativeCategoryIds":[]}',
    )
    expect(r?.categoryId).toBe('c1')
  })

  it('categoryId null aceito explicitamente', () => {
    const r = parseSuggestionJSON(
      '{"categoryId":null,"confidence":0.4,"reasoning":"recuso","alternativeCategoryIds":[]}',
    )
    expect(r?.categoryId).toBeNull()
  })

  it('JSON inválido → null', () => {
    expect(parseSuggestionJSON('not json')).toBeNull()
    expect(parseSuggestionJSON('{')).toBeNull()
  })

  it('confidence fora de range é clamp pra 0', () => {
    const r = parseSuggestionJSON(
      '{"categoryId":"c1","confidence":2.5,"reasoning":"x","alternativeCategoryIds":[]}',
    )
    expect(r?.confidence).toBe(0)
  })

  it('limita alternativeCategoryIds a 5 entries', () => {
    const r = parseSuggestionJSON(
      '{"categoryId":"c1","confidence":0.5,"reasoning":"x","alternativeCategoryIds":["a","b","c","d","e","f","g"]}',
    )
    expect(r?.alternativeCategoryIds).toHaveLength(5)
  })
})

describe('computeCostCents — pricing Haiku 4.5', () => {
  it('1M input tokens = $1.00 = 100 cents', () => {
    expect(computeCostCents(1_000_000, 0)).toBe(100)
  })

  it('1M output tokens = $5.00 = 500 cents', () => {
    expect(computeCostCents(0, 1_000_000)).toBe(500)
  })

  it('1k input + 100 output ≈ $0.0015 ≈ 0 cents (arredondamento)', () => {
    expect(computeCostCents(1000, 100)).toBe(0)
  })

  it('100k input + 10k output = $0.10 + $0.05 = 15 cents', () => {
    expect(computeCostCents(100_000, 10_000)).toBe(15)
  })
})

describe('isClaudeEnabled — gate', () => {
  it('false quando ANTHROPIC_API_KEY ausente', () => {
    const before = process.env.ANTHROPIC_API_KEY
    delete process.env.ANTHROPIC_API_KEY
    expect(isClaudeEnabled()).toBe(false)
    process.env.ANTHROPIC_API_KEY = before
  })

  it('false quando AI_CLAUDE_ENABLED=false', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test'
    process.env.AI_CLAUDE_ENABLED = 'false'
    expect(isClaudeEnabled()).toBe(false)
    delete process.env.AI_CLAUDE_ENABLED
    delete process.env.ANTHROPIC_API_KEY
  })

  it('true quando key presente e flag não bloqueia', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test'
    delete process.env.AI_CLAUDE_ENABLED
    expect(isClaudeEnabled()).toBe(true)
    delete process.env.ANTHROPIC_API_KEY
  })
})

describe('callClaude — fetch mockado', () => {
  it('disabled quando enabled=false', async () => {
    const r = await callClaude(baseInput, { enabled: false })
    expect(r.kind).toBe('disabled')
  })

  it('disabled quando apiKey ausente', async () => {
    const r = await callClaude(baseInput, { enabled: true, apiKey: '' })
    expect(r.kind).toBe('disabled')
  })

  it('success: parseia JSON + computa custo + retorna tokens', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      mockResponse(200, {
        content: [
          {
            type: 'text',
            text: '{"categoryId":"c1","confidence":0.8,"reasoning":"R","alternativeCategoryIds":[]}',
          },
        ],
        usage: { input_tokens: 1500, output_tokens: 80 },
        model: 'claude-haiku-4-5-20251001',
      }),
    )
    const r = await callClaude(baseInput, {
      fetcher,
      apiKey: 'sk-test',
      enabled: true,
    })
    expect(r.kind).toBe('success')
    if (r.kind === 'success') {
      expect(r.suggestion.categoryId).toBe('c1')
      expect(r.inputTokens).toBe(1500)
      expect(r.outputTokens).toBe(80)
      expect(r.modelVersion).toBe('claude-haiku-4-5-20251001')
      // costCents = (1500/1M)*100 + (80/1M)*500 = 0.15 + 0.04 = 0.19 → arred 0
      expect(r.costCents).toBeGreaterThanOrEqual(0)
    }
  })

  it('429 → rate-limited', async () => {
    const fetcher = vi.fn().mockResolvedValue(mockResponse(429))
    const r = await callClaude(baseInput, {
      fetcher,
      apiKey: 'sk-test',
      enabled: true,
    })
    expect(r.kind).toBe('rate-limited')
  })

  it('500 → error com status', async () => {
    const fetcher = vi.fn().mockResolvedValue(mockResponse(500))
    const r = await callClaude(baseInput, {
      fetcher,
      apiKey: 'sk-test',
      enabled: true,
    })
    expect(r.kind).toBe('error')
    if (r.kind === 'error') expect(r.status).toBe(500)
  })

  it('timeout (AbortError) → timeout', async () => {
    const fetcher = vi.fn().mockImplementation(() => {
      const err = new Error('aborted')
      err.name = 'AbortError'
      return Promise.reject(err)
    })
    const r = await callClaude(baseInput, {
      fetcher,
      apiKey: 'sk-test',
      enabled: true,
    })
    expect(r.kind).toBe('timeout')
  })

  it('response sem content text → invalid-json', async () => {
    const fetcher = vi.fn().mockResolvedValue(mockResponse(200, { content: [] }))
    const r = await callClaude(baseInput, {
      fetcher,
      apiKey: 'sk-test',
      enabled: true,
    })
    expect(r.kind).toBe('invalid-json')
  })

  it('text não-JSON → invalid-json', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      mockResponse(200, {
        content: [{ type: 'text', text: 'não é json' }],
        usage: { input_tokens: 0, output_tokens: 0 },
      }),
    )
    const r = await callClaude(baseInput, {
      fetcher,
      apiKey: 'sk-test',
      enabled: true,
    })
    expect(r.kind).toBe('invalid-json')
  })

  it('headers incluem x-api-key + anthropic-version (não loga em erro)', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      mockResponse(200, {
        content: [
          {
            type: 'text',
            text: '{"categoryId":"c1","confidence":0.5,"reasoning":"x","alternativeCategoryIds":[]}',
          },
        ],
        usage: { input_tokens: 100, output_tokens: 20 },
      }),
    )
    await callClaude(baseInput, {
      fetcher,
      apiKey: 'sk-test-12345',
      enabled: true,
    })
    expect(fetcher).toHaveBeenCalledTimes(1)
    const callArgs = fetcher.mock.calls[0]
    const url = callArgs[0]
    const init = callArgs[1] as RequestInit
    const headers = init.headers as Record<string, string>
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    expect(headers['x-api-key']).toBe('sk-test-12345')
    expect(headers['anthropic-version']).toBe('2023-06-01')
  })
})
