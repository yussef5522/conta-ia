// Sprint 4.0.3 — testes do match híbrido com Claude (fetch mocked).
// NÃO testa cache (precisaria DB) — só lógica de boost + fora de range.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { applyHybridBoost } from '@/lib/conciliacao/claude-judge'
import type { MatchScore, OFXTransaction, MatchCandidate } from '@/lib/conciliacao/match'

vi.mock('@/lib/db', () => ({
  prisma: {
    aiClaudeCache: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
  },
}))

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d))

const baseOFX: OFXTransaction = {
  id: 'ofx1',
  description: 'ENERGISA SA',
  amount: 380,
  type: 'DEBIT',
  date: utc(2026, 4, 28),
  supplierId: null,
  bankAccountId: 'bank1',
}

const baseCandidate: MatchCandidate = {
  id: 'pay1',
  lifecycle: 'PAYABLE',
  description: 'Energia ENERGISA — maio',
  amount: 380,
  dueDate: utc(2026, 4, 25),
  supplierId: null,
  customerId: null,
  categoryId: null,
}

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = 'sk-test-fake'
  process.env.AI_CLAUDE_ENABLED = 'true'
})

describe('applyHybridBoost — fora da faixa cinzenta', () => {
  it('score < 50 → retorna sem chamar IA', async () => {
    const base: MatchScore = {
      candidateId: 'pay1',
      score: 30,
      breakdown: { amount: 25, date: 5, supplier: 0, description: 0 },
      reasoning: ['Valor próximo (≤5%)'],
    }
    const fetcher = vi.fn()
    const r = await applyHybridBoost(base, baseOFX, baseCandidate, 'company-1', {
      fetcher: fetcher as unknown as typeof fetch,
    })
    expect(r).toEqual(base)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('score ≥ 70 → retorna sem chamar IA', async () => {
    const base: MatchScore = {
      candidateId: 'pay1',
      score: 85,
      breakdown: { amount: 50, date: 30, supplier: 0, description: 5 },
      reasoning: ['Valor exato', 'Mesmo dia'],
    }
    const fetcher = vi.fn()
    const r = await applyHybridBoost(base, baseOFX, baseCandidate, 'company-1', {
      fetcher: fetcher as unknown as typeof fetch,
    })
    expect(r).toEqual(base)
    expect(fetcher).not.toHaveBeenCalled()
  })
})

describe('applyHybridBoost — faixa cinzenta 50-69', () => {
  it('chama IA quando score = 50', async () => {
    const base: MatchScore = {
      candidateId: 'pay1',
      score: 50,
      breakdown: { amount: 50, date: 0, supplier: 0, description: 0 },
      reasoning: ['Valor exato'],
    }
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: '{"boost": 20, "reasoning": "Descrição compatível"}' }],
      }),
    })
    const r = await applyHybridBoost(base, baseOFX, baseCandidate, 'company-1', {
      fetcher: fetcher as unknown as typeof fetch,
    })
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(r.score).toBe(70)
    expect(r.aiBoost).toBe(20)
    expect(r.aiReasoning).toBe('Descrição compatível')
    expect(r.reasoning).toContain('IA: Descrição compatível (+20pts)')
  })

  it('boost capa em 100', async () => {
    const base: MatchScore = {
      candidateId: 'pay1',
      score: 65,
      breakdown: { amount: 50, date: 15, supplier: 0, description: 0 },
      reasoning: [],
    }
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: '{"boost": 50, "reasoning": "Certeza"}' }], // boost > 30 será clampado
      }),
    })
    const r = await applyHybridBoost(base, baseOFX, baseCandidate, 'company-1', {
      fetcher: fetcher as unknown as typeof fetch,
    })
    // Clamp 50→30, então 65+30=95
    expect(r.score).toBe(95)
    expect(r.aiBoost).toBe(30)
  })

  it('fetch falha (network) → retorna score original sem boost', async () => {
    const base: MatchScore = {
      candidateId: 'pay1',
      score: 55,
      breakdown: { amount: 50, date: 5, supplier: 0, description: 0 },
      reasoning: [],
    }
    const fetcher = vi.fn().mockRejectedValue(new Error('network'))
    const r = await applyHybridBoost(base, baseOFX, baseCandidate, 'company-1', {
      fetcher: fetcher as unknown as typeof fetch,
    })
    expect(r.score).toBe(55) // não mudou
    expect(r.aiBoost).toBeUndefined()
  })

  it('Claude retorna texto sem JSON → ignora boost', async () => {
    const base: MatchScore = {
      candidateId: 'pay1',
      score: 60,
      breakdown: { amount: 50, date: 5, supplier: 5, description: 0 },
      reasoning: [],
    }
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ text: 'desculpe não consegui responder' }] }),
    })
    const r = await applyHybridBoost(base, baseOFX, baseCandidate, 'company-1', {
      fetcher: fetcher as unknown as typeof fetch,
    })
    expect(r.score).toBe(60)
  })

  it('Claude retorna boost negativo → clampa pra 0 (não reduz score)', async () => {
    const base: MatchScore = {
      candidateId: 'pay1',
      score: 60,
      breakdown: { amount: 50, date: 5, supplier: 5, description: 0 },
      reasoning: [],
    }
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: '{"boost": -10, "reasoning": "Descartar"}' }],
      }),
    })
    const r = await applyHybridBoost(base, baseOFX, baseCandidate, 'company-1', {
      fetcher: fetcher as unknown as typeof fetch,
    })
    expect(r.score).toBe(60) // boost clampado pra 0
    expect(r.aiBoost).toBe(0)
  })

  it('API key ausente → não chama, retorna score original', async () => {
    delete process.env.ANTHROPIC_API_KEY
    const base: MatchScore = {
      candidateId: 'pay1',
      score: 60,
      breakdown: { amount: 50, date: 5, supplier: 5, description: 0 },
      reasoning: [],
    }
    const fetcher = vi.fn()
    const r = await applyHybridBoost(base, baseOFX, baseCandidate, 'company-1', {
      fetcher: fetcher as unknown as typeof fetch,
    })
    expect(fetcher).not.toHaveBeenCalled()
    expect(r.score).toBe(60)
  })
})
