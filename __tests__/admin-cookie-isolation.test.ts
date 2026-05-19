// Cross-domain isolation — Sprint 1.6.
// Garante que cookies do app NÃO autorizam admin e vice-versa.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { SignJWT } from 'jose'
import {
  verifyAdminToken,
  ADMIN_SCOPE,
  ADMIN_COOKIE_NAME,
} from '@/lib/admin-auth/jwt'

const ADMIN_SECRET = 'admin-secret-isolation-min-32-chars-zzzz-aaaa'
const APP_SECRET = 'app-secret-isolation-min-32-chars-zzzz-aaaa'

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

describe('Cross-domain isolation', () => {
  it('cookie names DIFERENTES (app vs admin)', async () => {
    const { COOKIE_NAME } = await import('@/lib/auth')
    expect(COOKIE_NAME).not.toBe(ADMIN_COOKIE_NAME)
    // App usa "auth_token" (legacy desde Fase 1); admin usa "admin_session"
    expect(COOKIE_NAME).toBe('auth_token')
    expect(ADMIN_COOKIE_NAME).toBe('admin_session')
  })

  it('JWT do APP (mesmo scope password-reset) NUNCA passa em verifyAdminToken', async () => {
    // Cenário: cliente compromete JWT_SECRET do app → tenta forjar admin token
    // Não funciona porque verifyAdminToken usa JWT_SECRET_ADMIN diferente.
    const appSecret = new TextEncoder().encode(APP_SECRET)
    const appLikeToken = await new SignJWT({
      sub: 'user-attacker',
      email: 'attacker@x.com',
      name: 'Attacker',
      role: 'OWNER',
      scope: ADMIN_SCOPE, // mesmo scope, mas assinado com secret errado
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(appSecret)

    await expect(verifyAdminToken(appLikeToken)).rejects.toThrow()
  })

  it('JWT do ADMIN com scope errado NÃO passa em verifyAdminToken', async () => {
    // Cenário: alguém pega o JWT_SECRET_ADMIN mas tenta forjar com scope errado
    const adminSecret = new TextEncoder().encode(ADMIN_SECRET)
    const wrongScopeToken = await new SignJWT({
      sub: 'g-1',
      email: 'g@x.com',
      name: 'G',
      role: 'OWNER',
      scope: 'app-session', // scope fake
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(adminSecret)

    await expect(verifyAdminToken(wrongScopeToken)).rejects.toThrow(/escopo/i)
  })

  it('Token expirado é rejeitado mesmo com scope/secret corretos', async () => {
    const adminSecret = new TextEncoder().encode(ADMIN_SECRET)
    const expiredToken = await new SignJWT({
      sub: 'g-1',
      email: 'g@x.com',
      name: 'G',
      role: 'OWNER',
      scope: ADMIN_SCOPE,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200) // 2h atrás
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600) // expirou 1h atrás
      .sign(adminSecret)

    await expect(verifyAdminToken(expiredToken)).rejects.toThrow()
  })
})

describe('isAdminHost — guard de host', () => {
  it('admin.caixaos.com.br → true (host real prod)', async () => {
    const { isAdminHost } = await import('@/lib/middleware/subdomain')
    expect(isAdminHost('admin.caixaos.com.br')).toBe(true)
  })

  it('app.caixaos.com.br → false', async () => {
    const { isAdminHost } = await import('@/lib/middleware/subdomain')
    expect(isAdminHost('app.caixaos.com.br')).toBe(false)
  })

  it('caixaos.com.br (raiz) → false (não é admin)', async () => {
    const { isAdminHost } = await import('@/lib/middleware/subdomain')
    expect(isAdminHost('caixaos.com.br')).toBe(false)
  })
})
