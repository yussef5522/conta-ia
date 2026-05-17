// Rate limit do login — Sprint 1.2.
// Testa o helper rateLimit que o endpoint usa: 5 tentativas / 15 min por IP.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { rateLimit, rateLimitKey } from '@/lib/rate-limit'

describe('rateLimit — janela 5 tentativas / 15 min', () => {
  let nowSpy: ReturnType<typeof vi.spyOn>
  let now = 0

  beforeEach(() => {
    now = 1_000_000
    nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => now)
  })

  it('permite primeira tentativa', () => {
    const r = rateLimit('login:ip-test-1', 5, 15 * 60_000)
    expect(r.allowed).toBe(true)
    expect(r.remaining).toBe(4)
    nowSpy.mockRestore()
  })

  it('permite até 5 tentativas, bloqueia a 6ª', () => {
    const key = 'login:ip-burst'
    for (let i = 1; i <= 5; i++) {
      const r = rateLimit(key, 5, 15 * 60_000)
      expect(r.allowed).toBe(true)
    }
    const r6 = rateLimit(key, 5, 15 * 60_000)
    expect(r6.allowed).toBe(false)
    expect(r6.retryAfterMs).toBeGreaterThan(0)
    nowSpy.mockRestore()
  })

  it('reseta após a janela (15 min)', () => {
    const key = 'login:ip-reset'
    for (let i = 1; i <= 5; i++) rateLimit(key, 5, 15 * 60_000)
    expect(rateLimit(key, 5, 15 * 60_000).allowed).toBe(false)
    // Avança 15 min + 1 ms
    now += 15 * 60_000 + 1
    const fresh = rateLimit(key, 5, 15 * 60_000)
    expect(fresh.allowed).toBe(true)
    nowSpy.mockRestore()
  })

  it('chaves diferentes (IPs distintos) não interferem', () => {
    for (let i = 1; i <= 5; i++) rateLimit('login:ip-A', 5, 15 * 60_000)
    expect(rateLimit('login:ip-A', 5, 15 * 60_000).allowed).toBe(false)
    expect(rateLimit('login:ip-B', 5, 15 * 60_000).allowed).toBe(true)
    nowSpy.mockRestore()
  })
})

describe('rateLimitKey — extração de IP', () => {
  it('usa x-forwarded-for quando presente', () => {
    const req = new Request('http://test.local', {
      headers: { 'x-forwarded-for': '203.0.113.42, 10.0.0.1' },
    })
    expect(rateLimitKey(req, 'login')).toBe('login:203.0.113.42')
  })

  it('fallback pra x-real-ip', () => {
    const req = new Request('http://test.local', {
      headers: { 'x-real-ip': '198.51.100.7' },
    })
    expect(rateLimitKey(req, 'login')).toBe('login:198.51.100.7')
  })

  it('fallback "unknown" quando nenhum header de IP', () => {
    const req = new Request('http://test.local')
    expect(rateLimitKey(req, 'login')).toBe('login:unknown')
  })
})
