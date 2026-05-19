// Rate limits do fluxo Esqueci senha — Sprint 1.5.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  checkRequestLimit,
  checkResendLimit,
  checkVerifyLimit,
  REQUEST_LIMIT,
  RESEND_LIMIT,
  VERIFY_LIMIT,
  MAX_CODE_ATTEMPTS_PER_CODE,
} from '@/lib/security/forgot-password-rate-limit'

describe('forgot-password rate limits — constantes', () => {
  it('REQUEST_LIMIT = 3', () => expect(REQUEST_LIMIT).toBe(3))
  it('RESEND_LIMIT = 1', () => expect(RESEND_LIMIT).toBe(1))
  it('VERIFY_LIMIT = 10', () => expect(VERIFY_LIMIT).toBe(10))
  it('MAX_CODE_ATTEMPTS_PER_CODE = 5', () =>
    expect(MAX_CODE_ATTEMPTS_PER_CODE).toBe(5))
})

describe('checkRequestLimit', () => {
  let nowSpy: ReturnType<typeof vi.spyOn>
  let now = 0

  beforeEach(() => {
    now = 1_000_000_000
    nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => now)
  })

  it('permite primeira solicitação', () => {
    const r = checkRequestLimit('test1@email.com')
    expect(r.allowed).toBe(true)
    nowSpy.mockRestore()
  })

  it('bloqueia após 3 solicitações em 15 min', () => {
    const email = 'burst@email.com'
    expect(checkRequestLimit(email).allowed).toBe(true)
    expect(checkRequestLimit(email).allowed).toBe(true)
    expect(checkRequestLimit(email).allowed).toBe(true)
    const blocked = checkRequestLimit(email)
    expect(blocked.allowed).toBe(false)
    expect(blocked.reason).toBe('request')
    expect(blocked.message).toMatch(/Tente novamente/)
    nowSpy.mockRestore()
  })

  it('emails distintos não interferem', () => {
    for (let i = 0; i < 3; i++) checkRequestLimit('a@x.com')
    expect(checkRequestLimit('a@x.com').allowed).toBe(false)
    expect(checkRequestLimit('b@x.com').allowed).toBe(true)
    nowSpy.mockRestore()
  })

  it('email é case-insensitive', () => {
    const emailLow = 'caso@x.com'
    for (let i = 0; i < 3; i++) checkRequestLimit(emailLow)
    expect(checkRequestLimit('CASO@x.com').allowed).toBe(false)
    nowSpy.mockRestore()
  })
})

describe('checkResendLimit', () => {
  let nowSpy: ReturnType<typeof vi.spyOn>
  let now = 0

  beforeEach(() => {
    now = 2_000_000_000
    nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => now)
  })

  it('permite primeira chamada', () => {
    expect(checkResendLimit('first@x.com').allowed).toBe(true)
    nowSpy.mockRestore()
  })

  it('bloqueia segunda dentro de 60s', () => {
    const email = 'spam@x.com'
    expect(checkResendLimit(email).allowed).toBe(true)
    const second = checkResendLimit(email)
    expect(second.allowed).toBe(false)
    expect(second.reason).toBe('resend')
    nowSpy.mockRestore()
  })

  it('libera após 60s', () => {
    const email = 'wait@x.com'
    checkResendLimit(email)
    expect(checkResendLimit(email).allowed).toBe(false)
    now += 61_000
    expect(checkResendLimit(email).allowed).toBe(true)
    nowSpy.mockRestore()
  })
})

describe('checkVerifyLimit', () => {
  let nowSpy: ReturnType<typeof vi.spyOn>
  let now = 0

  beforeEach(() => {
    now = 3_000_000_000
    nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => now)
  })

  it('permite até 10 verificações em 15 min', () => {
    const email = 'verify@x.com'
    for (let i = 0; i < 10; i++) {
      expect(checkVerifyLimit(email).allowed).toBe(true)
    }
    const blocked = checkVerifyLimit(email)
    expect(blocked.allowed).toBe(false)
    expect(blocked.reason).toBe('verify')
    nowSpy.mockRestore()
  })
})
