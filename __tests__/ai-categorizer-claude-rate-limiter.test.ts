// Rate limiter — Fase 3 Etapa 3.
// Cobre o que é PURO (env reading). DB-coupled é coberto via smoke prod.

import { describe, it, expect, afterEach } from 'vitest'
import { getRateLimits } from '@/lib/ai-categorizer/claude-rate-limiter'

afterEach(() => {
  delete process.env.AI_CLAUDE_MAX_PER_MIN
  delete process.env.AI_CLAUDE_MAX_PER_DAY
})

describe('getRateLimits — env-driven', () => {
  it('defaults: 10/min + 1000/dia', () => {
    expect(getRateLimits()).toEqual({ perMinute: 10, perDay: 1000 })
  })

  it('lê AI_CLAUDE_MAX_PER_MIN do env', () => {
    process.env.AI_CLAUDE_MAX_PER_MIN = '25'
    expect(getRateLimits().perMinute).toBe(25)
  })

  it('lê AI_CLAUDE_MAX_PER_DAY do env', () => {
    process.env.AI_CLAUDE_MAX_PER_DAY = '500'
    expect(getRateLimits().perDay).toBe(500)
  })

  it('valor inválido (NaN) cai pra default', () => {
    process.env.AI_CLAUDE_MAX_PER_MIN = 'abc'
    expect(getRateLimits().perMinute).toBe(10)
  })

  it('valor não-positivo (0, negativo) cai pra default', () => {
    process.env.AI_CLAUDE_MAX_PER_MIN = '0'
    expect(getRateLimits().perMinute).toBe(10)
    process.env.AI_CLAUDE_MAX_PER_MIN = '-5'
    expect(getRateLimits().perMinute).toBe(10)
  })

  it('aceita perMinute = 1 (validação inclusiva)', () => {
    process.env.AI_CLAUDE_MAX_PER_MIN = '1'
    expect(getRateLimits().perMinute).toBe(1)
  })
})
