// Rate limit do login admin — Sprint 1.6.
// 5 tentativas / 15 min POR IP.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  checkAdminLoginRateLimit,
  ADMIN_LOGIN_MAX_ATTEMPTS,
  ADMIN_LOGIN_WINDOW_MS,
} from '@/lib/admin-auth/rate-limit'

describe('admin-login rate limit — constantes', () => {
  it('5 tentativas / 15 min', () => {
    expect(ADMIN_LOGIN_MAX_ATTEMPTS).toBe(5)
    expect(ADMIN_LOGIN_WINDOW_MS).toBe(15 * 60 * 1000)
  })
})

describe('checkAdminLoginRateLimit — por IP', () => {
  let nowSpy: ReturnType<typeof vi.spyOn>
  let now = 0

  beforeEach(() => {
    now = 5_000_000_000
    nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => now)
  })

  function makeReq(ip: string): Request {
    return new Request('http://test.local/admin/login', {
      method: 'POST',
      headers: { 'x-forwarded-for': ip },
    })
  }

  it('permite 5 tentativas, bloqueia a 6ª', () => {
    const req = makeReq('203.0.113.10')
    for (let i = 1; i <= 5; i++) {
      const r = checkAdminLoginRateLimit(req)
      expect(r.allowed).toBe(true)
    }
    const blocked = checkAdminLoginRateLimit(req)
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterMs).toBeGreaterThan(0)
    expect(blocked.retryAfterMinutes).toBeGreaterThanOrEqual(1)
    nowSpy.mockRestore()
  })

  it('IPs distintos NÃO interferem (por IP, não por email)', () => {
    const reqA = makeReq('203.0.113.20')
    const reqB = makeReq('198.51.100.30')
    for (let i = 1; i <= 5; i++) checkAdminLoginRateLimit(reqA)
    expect(checkAdminLoginRateLimit(reqA).allowed).toBe(false)
    expect(checkAdminLoginRateLimit(reqB).allowed).toBe(true)
    nowSpy.mockRestore()
  })

  it('libera após 15 min', () => {
    const req = makeReq('203.0.113.40')
    for (let i = 1; i <= 5; i++) checkAdminLoginRateLimit(req)
    expect(checkAdminLoginRateLimit(req).allowed).toBe(false)
    now += 15 * 60_000 + 1
    expect(checkAdminLoginRateLimit(req).allowed).toBe(true)
    nowSpy.mockRestore()
  })

  it('retryAfterMinutes mínimo é 1 (UX — nunca "0 minutos")', () => {
    const req = makeReq('203.0.113.50')
    for (let i = 1; i <= 5; i++) checkAdminLoginRateLimit(req)
    // Avança 14:59 → ainda bloqueado
    now += 14 * 60_000 + 59_000
    const r = checkAdminLoginRateLimit(req)
    expect(r.allowed).toBe(false)
    expect(r.retryAfterMinutes).toBeGreaterThanOrEqual(1)
    nowSpy.mockRestore()
  })
})
