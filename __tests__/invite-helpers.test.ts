import { describe, it, expect } from 'vitest'
import {
  generateInviteToken,
  calculateExpiration,
  inviteCreateSchema,
  userRoleChangeSchema,
  acceptInviteSchema,
  getInviteStatus,
  buildInviteUrl,
  INVITE_EXPIRES_DAYS,
} from '../lib/invites/helpers'

describe('generateInviteToken', () => {
  it('gera token de 64 chars hex', () => {
    const token = generateInviteToken()
    expect(token.length).toBe(64)
    expect(/^[0-9a-f]+$/.test(token)).toBe(true)
  })

  it('gera tokens únicos', () => {
    const t1 = generateInviteToken()
    const t2 = generateInviteToken()
    expect(t1).not.toBe(t2)
  })
})

describe('calculateExpiration', () => {
  it('retorna data 7 dias no futuro', () => {
    const now = Date.now()
    const exp = calculateExpiration().getTime()
    const diffDays = Math.round((exp - now) / (1000 * 60 * 60 * 24))
    expect(diffDays).toBe(INVITE_EXPIRES_DAYS)
  })
})

describe('inviteCreateSchema', () => {
  it('valida email + roleId', () => {
    const r = inviteCreateSchema.safeParse({
      email: 'test@example.com',
      roleId: 'cl1234567890123456789012',
    })
    expect(r.success).toBe(true)
  })

  it('rejeita email inválido', () => {
    const r = inviteCreateSchema.safeParse({
      email: 'not-an-email',
      roleId: 'cl1234567890123456789012',
    })
    expect(r.success).toBe(false)
  })

  it('rejeita roleId não-cuid', () => {
    const r = inviteCreateSchema.safeParse({
      email: 'a@b.com',
      roleId: 'invalid',
    })
    expect(r.success).toBe(false)
  })

  it('normaliza email pra lowercase', () => {
    const r = inviteCreateSchema.parse({
      email: 'JOAO@EMPRESA.COM',
      roleId: 'cl1234567890123456789012',
    })
    expect(r.email).toBe('joao@empresa.com')
  })
})

describe('userRoleChangeSchema', () => {
  it('valida roleId cuid', () => {
    const r = userRoleChangeSchema.safeParse({
      roleId: 'cl1234567890123456789012',
    })
    expect(r.success).toBe(true)
  })

  it('rejeita roleId vazio', () => {
    const r = userRoleChangeSchema.safeParse({ roleId: '' })
    expect(r.success).toBe(false)
  })
})

describe('acceptInviteSchema', () => {
  it('valida token de 32+ chars', () => {
    const token = 'a'.repeat(32)
    expect(acceptInviteSchema.safeParse({ token }).success).toBe(true)
  })

  it('rejeita token curto', () => {
    expect(acceptInviteSchema.safeParse({ token: 'short' }).success).toBe(false)
  })
})

describe('getInviteStatus', () => {
  it('PENDING: não aceito + não expirado', () => {
    const future = new Date()
    future.setDate(future.getDate() + 1)
    expect(getInviteStatus({ acceptedAt: null, expiresAt: future })).toBe('PENDING')
  })

  it('ACCEPTED: tem acceptedAt', () => {
    expect(getInviteStatus({ acceptedAt: new Date(), expiresAt: new Date() })).toBe(
      'ACCEPTED',
    )
  })

  it('EXPIRED: não aceito + expirado', () => {
    const past = new Date()
    past.setDate(past.getDate() - 1)
    expect(getInviteStatus({ acceptedAt: null, expiresAt: past })).toBe('EXPIRED')
  })

  it('ACCEPTED tem precedência sobre EXPIRED', () => {
    const past = new Date()
    past.setDate(past.getDate() - 1)
    expect(getInviteStatus({ acceptedAt: new Date(), expiresAt: past })).toBe('ACCEPTED')
  })
})

describe('buildInviteUrl', () => {
  it('constrói URL com token', () => {
    expect(buildInviteUrl('https://app.com', 'abc')).toBe(
      'https://app.com/aceitar-convite?token=abc',
    )
  })

  it('lida com baseUrl com path', () => {
    expect(buildInviteUrl('https://app.com/sub', 'xyz')).toBe(
      'https://app.com/sub/aceitar-convite?token=xyz',
    )
  })
})

describe('INVITE_EXPIRES_DAYS constant', () => {
  it('é 7 dias', () => {
    expect(INVITE_EXPIRES_DAYS).toBe(7)
  })
})
