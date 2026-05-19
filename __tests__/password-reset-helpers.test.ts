// Helpers do fluxo "Esqueci senha" — Sprint 1.5.

import { describe, it, expect, beforeAll } from 'vitest'
import {
  generateResetCode,
  codeHint,
  hashCode,
  verifyCode,
  checkPasswordStrength,
  signResetToken,
  verifyResetToken,
  CODE_LENGTH,
  CODE_EXPIRES_MIN,
  RESET_TOKEN_EXPIRES_MIN,
} from '@/lib/auth/password-reset'

// JWT_SECRET é necessário pros sign/verify tokens
beforeAll(() => {
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'test-secret-not-for-production-min-32-chars-long-xx'
  }
})

describe('generateResetCode', () => {
  it('gera código de 6 dígitos', () => {
    const code = generateResetCode()
    expect(code).toMatch(/^[0-9]{6}$/)
    expect(code.length).toBe(CODE_LENGTH)
  })

  it('códigos pequenos têm leading zeros', () => {
    // Roda várias vezes pra aumentar chance de pegar um < 100000
    for (let i = 0; i < 50; i++) {
      const c = generateResetCode()
      expect(c.length).toBe(6)
    }
  })

  it('códigos sucessivos são diferentes (alta entropia)', () => {
    const codes = new Set<string>()
    for (let i = 0; i < 20; i++) codes.add(generateResetCode())
    // Em 20 randoms, deve haver pelo menos 19 únicos (colisão é improvável)
    expect(codes.size).toBeGreaterThanOrEqual(19)
  })
})

describe('codeHint', () => {
  it('mascara mostrando primeiros 2 dígitos', () => {
    expect(codeHint('123456')).toBe('12****')
    expect(codeHint('048293')).toBe('04****')
  })

  it('código inválido retorna string vazia', () => {
    expect(codeHint('123')).toBe('')
    expect(codeHint('')).toBe('')
  })
})

describe('hashCode + verifyCode', () => {
  it('hash + verify roundtrip funciona', async () => {
    const code = '123456'
    const hash = await hashCode(code)
    expect(hash).not.toBe(code) // bcrypt não armazena texto puro
    expect(hash.startsWith('$2')).toBe(true) // bcrypt prefix
    expect(await verifyCode(code, hash)).toBe(true)
    expect(await verifyCode('999999', hash)).toBe(false)
  })

  it('hashes diferentes pra mesma input (salt random)', async () => {
    const code = '123456'
    const h1 = await hashCode(code)
    const h2 = await hashCode(code)
    expect(h1).not.toBe(h2)
    expect(await verifyCode(code, h1)).toBe(true)
    expect(await verifyCode(code, h2)).toBe(true)
  })
})

describe('checkPasswordStrength', () => {
  it('senha curta → erro + level=weak', () => {
    const r = checkPasswordStrength('abc')
    expect(r.ok).toBe(false)
    expect(r.errors.length).toBeGreaterThan(0)
    expect(r.level).toBe('weak')
  })

  it('sem letra → erro', () => {
    const r = checkPasswordStrength('12345678')
    expect(r.ok).toBe(false)
    expect(r.errors.some((e) => /letra/i.test(e))).toBe(true)
  })

  it('sem número → erro', () => {
    const r = checkPasswordStrength('apenasletras')
    expect(r.ok).toBe(false)
    expect(r.errors.some((e) => /número/i.test(e))).toBe(true)
  })

  it('senha mínima válida → ok + level=medium', () => {
    const r = checkPasswordStrength('abc12345')
    expect(r.ok).toBe(true)
    expect(r.level).toBe('medium')
  })

  it('senha forte (12+ + maiúscula + especial) → level=strong', () => {
    const r = checkPasswordStrength('SenhaForte123!')
    expect(r.ok).toBe(true)
    expect(r.level).toBe('strong')
  })

  it('CODE_EXPIRES_MIN = 15 + RESET_TOKEN_EXPIRES_MIN = 15', () => {
    expect(CODE_EXPIRES_MIN).toBe(15)
    expect(RESET_TOKEN_EXPIRES_MIN).toBe(15)
  })
})

describe('signResetToken + verifyResetToken', () => {
  it('roundtrip preserva sub + email + scope', async () => {
    const token = await signResetToken({
      sub: 'user-123',
      email: 'a@b.com',
    })
    const payload = await verifyResetToken(token)
    expect(payload.sub).toBe('user-123')
    expect(payload.email).toBe('a@b.com')
    expect(payload.scope).toBe('password-reset')
    expect(payload.jti.length).toBeGreaterThan(0)
  })

  it('token inválido lança', async () => {
    await expect(verifyResetToken('not-a-token')).rejects.toThrow()
  })

  it('cada token tem jti único', async () => {
    const t1 = await signResetToken({ sub: 'u', email: 'a@b.com' })
    const t2 = await signResetToken({ sub: 'u', email: 'a@b.com' })
    const p1 = await verifyResetToken(t1)
    const p2 = await verifyResetToken(t2)
    expect(p1.jti).not.toBe(p2.jti)
  })
})
