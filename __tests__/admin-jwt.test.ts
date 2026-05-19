// JWT do painel Gerenciador — Sprint 1.6.
// Roundtrip sign/verify + scope check + isolamento de secrets.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { SignJWT } from 'jose'
import {
  signAdminToken,
  verifyAdminToken,
  ADMIN_SCOPE,
  ADMIN_COOKIE_NAME,
  ADMIN_TOKEN_TTL_HOURS,
  getAdminCookieOptions,
} from '@/lib/admin-auth/jwt'

// Secrets distintos
const ADMIN_SECRET = 'admin-secret-test-min-32-chars-xx-yyyyyy'
const APP_SECRET = 'app-secret-test-min-32-chars-xx-yyyyyy'

let originalAdmin: string | undefined
let originalApp: string | undefined

beforeAll(() => {
  originalAdmin = process.env.JWT_SECRET_ADMIN
  originalApp = process.env.JWT_SECRET
  process.env.JWT_SECRET_ADMIN = ADMIN_SECRET
  process.env.JWT_SECRET = APP_SECRET
})

afterAll(() => {
  if (originalAdmin === undefined) delete process.env.JWT_SECRET_ADMIN
  else process.env.JWT_SECRET_ADMIN = originalAdmin
  if (originalApp === undefined) delete process.env.JWT_SECRET
  else process.env.JWT_SECRET = originalApp
})

describe('signAdminToken + verifyAdminToken', () => {
  it('roundtrip preserva sub/email/name/role + scope=admin-session', async () => {
    const token = await signAdminToken({
      sub: 'g-123',
      email: 'admin@caixaos.com.br',
      name: 'Yussef',
      role: 'OWNER',
    })
    const payload = await verifyAdminToken(token)
    expect(payload.sub).toBe('g-123')
    expect(payload.email).toBe('admin@caixaos.com.br')
    expect(payload.name).toBe('Yussef')
    expect(payload.role).toBe('OWNER')
    expect(payload.scope).toBe(ADMIN_SCOPE)
  })

  it('token assinado com OUTRO secret é rejeitado (isolamento crítico)', async () => {
    const otherSecret = new TextEncoder().encode(APP_SECRET)
    const fakeToken = await new SignJWT({
      sub: 'attacker',
      email: 'evil@x.com',
      name: 'Evil',
      role: 'OWNER',
      scope: ADMIN_SCOPE,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(otherSecret)

    await expect(verifyAdminToken(fakeToken)).rejects.toThrow()
  })

  it('token com scope DIFERENTE é rejeitado', async () => {
    const secret = new TextEncoder().encode(ADMIN_SECRET)
    const wrongScope = await new SignJWT({
      sub: 'u-1',
      email: 'u@x.com',
      name: 'Test',
      role: 'OWNER',
      scope: 'password-reset', // scope do esqueci-senha, NÃO admin
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(secret)

    await expect(verifyAdminToken(wrongScope)).rejects.toThrow(/escopo/i)
  })

  it('token malformado é rejeitado', async () => {
    await expect(verifyAdminToken('not.a.jwt')).rejects.toThrow()
  })

  it('falta JWT_SECRET_ADMIN → erro explícito', async () => {
    delete process.env.JWT_SECRET_ADMIN
    await expect(
      signAdminToken({ sub: 'x', email: 'x@x.com', name: 'X', role: 'OWNER' }),
    ).rejects.toThrow(/JWT_SECRET_ADMIN/)
    process.env.JWT_SECRET_ADMIN = ADMIN_SECRET
  })

  it('JWT_SECRET_ADMIN muito curto (<32 chars) é rejeitado', async () => {
    process.env.JWT_SECRET_ADMIN = 'curto-demais'
    await expect(
      signAdminToken({ sub: 'x', email: 'x@x.com', name: 'X', role: 'OWNER' }),
    ).rejects.toThrow(/curto/)
    process.env.JWT_SECRET_ADMIN = ADMIN_SECRET
  })

  it('constantes corretas', () => {
    expect(ADMIN_SCOPE).toBe('admin-session')
    expect(ADMIN_COOKIE_NAME).toBe('admin_session')
    expect(ADMIN_TOKEN_TTL_HOURS).toBe(24)
  })
})

describe('getAdminCookieOptions', () => {
  // Helper: aceita NODE_ENV via cast (Node 20+ não permite Object.defineProperty)
  function setNodeEnv(v: string | undefined) {
    if (v === undefined) {
      // @ts-expect-error — runtime override
      delete process.env.NODE_ENV
    } else {
      // @ts-expect-error — runtime override
      process.env.NODE_ENV = v
    }
  }

  it('em prod aplica Domain=admin.caixaos.com.br por default', () => {
    const original = process.env.NODE_ENV
    setNodeEnv('production')
    delete process.env.ADMIN_COOKIE_DOMAIN
    delete process.env.COOKIE_SECURE
    const opts = getAdminCookieOptions()
    expect(opts.domain).toBe('admin.caixaos.com.br')
    expect(opts.httpOnly).toBe(true)
    expect(opts.secure).toBe(true)
    expect(opts.sameSite).toBe('lax')
    setNodeEnv(original)
  })

  it('em dev OMITE Domain (cookie host-only)', () => {
    const original = process.env.NODE_ENV
    setNodeEnv('development')
    const opts = getAdminCookieOptions()
    expect(opts.domain).toBeUndefined()
    expect(opts.secure).toBe(false)
    setNodeEnv(original)
  })

  it('respeita override ADMIN_COOKIE_DOMAIN=off em prod (cookie host-only)', () => {
    const original = process.env.NODE_ENV
    setNodeEnv('production')
    process.env.ADMIN_COOKIE_DOMAIN = 'off'
    const opts = getAdminCookieOptions()
    expect(opts.domain).toBeUndefined()
    delete process.env.ADMIN_COOKIE_DOMAIN
    setNodeEnv(original)
  })
})
