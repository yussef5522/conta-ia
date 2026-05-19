// Rate limit do endpoint público /api/coupons/validate — Sprint 1.7.
// Reusa rateLimit de @/lib/rate-limit; aqui validamos a config 10/min/IP
// e que keys de IPs distintos não interferem.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { rateLimit } from '@/lib/rate-limit'

describe('coupon-validate rate limit (10/min/IP)', () => {
  let nowSpy: ReturnType<typeof vi.spyOn>
  let now = 0

  beforeEach(() => {
    now = 8_000_000_000
    nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => now)
  })

  function key(ip: string) {
    return `coupon-validate:${ip}`
  }

  it('permite 10 chamadas no minuto, bloqueia a 11ª', () => {
    const k = key('203.0.113.99')
    for (let i = 1; i <= 10; i++) {
      const r = rateLimit(k, 10, 60_000)
      expect(r.allowed).toBe(true)
    }
    const blocked = rateLimit(k, 10, 60_000)
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterMs).toBeGreaterThan(0)
    nowSpy.mockRestore()
  })

  it('IPs distintos NÃO se afetam', () => {
    const a = key('1.1.1.1')
    const b = key('2.2.2.2')
    for (let i = 1; i <= 10; i++) rateLimit(a, 10, 60_000)
    expect(rateLimit(a, 10, 60_000).allowed).toBe(false)
    expect(rateLimit(b, 10, 60_000).allowed).toBe(true)
    nowSpy.mockRestore()
  })

  it('libera após 1 minuto', () => {
    const k = key('3.3.3.3')
    for (let i = 1; i <= 10; i++) rateLimit(k, 10, 60_000)
    expect(rateLimit(k, 10, 60_000).allowed).toBe(false)
    now += 60_001
    expect(rateLimit(k, 10, 60_000).allowed).toBe(true)
    nowSpy.mockRestore()
  })
})
