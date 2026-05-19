// JWT do painel Gerenciador — Sprint 1.6.
// Secret SEPARADO do app (JWT_SECRET_ADMIN) + scope=admin-session.
//
// Vazamento do JWT_SECRET do app NÃO compromete admin (e vice-versa) por design.

import { SignJWT, jwtVerify } from 'jose'

export const ADMIN_COOKIE_NAME = 'admin_session'
export const ADMIN_SCOPE = 'admin-session'
export const ADMIN_TOKEN_TTL_HOURS = 24

function getAdminSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET_ADMIN
  if (!secret) {
    throw new Error(
      'JWT_SECRET_ADMIN não configurado. Sprint 1.6 exige secret SEPARADO do JWT_SECRET principal.',
    )
  }
  if (secret.length < 32) {
    throw new Error('JWT_SECRET_ADMIN muito curto (mínimo 32 chars)')
  }
  return new TextEncoder().encode(secret)
}

export interface AdminTokenPayload {
  sub: string // gerenciadorId
  email: string
  name: string
  role: string // OPERADOR | OWNER
  scope: typeof ADMIN_SCOPE
}

export async function signAdminToken(payload: {
  sub: string
  email: string
  name: string
  role: string
}): Promise<string> {
  const secret = getAdminSecret()
  return new SignJWT({ ...payload, scope: ADMIN_SCOPE })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_TOKEN_TTL_HOURS}h`)
    .sign(secret)
}

export async function verifyAdminToken(
  token: string,
): Promise<AdminTokenPayload> {
  const secret = getAdminSecret()
  const { payload } = await jwtVerify(token, secret)
  if (payload.scope !== ADMIN_SCOPE) {
    throw new Error('Token com escopo inválido (esperado admin-session)')
  }
  if (
    !payload.sub ||
    typeof payload.email !== 'string' ||
    typeof payload.name !== 'string' ||
    typeof payload.role !== 'string'
  ) {
    throw new Error('Token admin mal formado')
  }
  return {
    sub: String(payload.sub),
    email: payload.email,
    name: payload.name,
    role: payload.role,
    scope: ADMIN_SCOPE,
  }
}

// Cookie options pro Set-Cookie response.
// Domain=admin.caixaos.com.br LITERAL (sem ponto inicial) = host-exclusive.
// NÃO vaza pra app.caixaos.com.br.
//
// Em dev local (sem HTTPS), COOKIE_SECURE pode ser overrido via env.
export function getAdminCookieOptions(): {
  httpOnly: boolean
  secure: boolean
  sameSite: 'lax'
  path: string
  maxAge: number
  domain?: string
} {
  const isProd = process.env.NODE_ENV === 'production'
  // Em prod, restringe a admin.caixaos.com.br. Em dev, omite (vale só pro host).
  const domain =
    isProd && process.env.ADMIN_COOKIE_DOMAIN !== 'off'
      ? (process.env.ADMIN_COOKIE_DOMAIN ?? 'admin.caixaos.com.br')
      : undefined
  const secureFlag =
    process.env.COOKIE_SECURE === 'false' ? false : isProd

  return {
    httpOnly: true,
    secure: secureFlag,
    sameSite: 'lax',
    path: '/',
    maxAge: ADMIN_TOKEN_TTL_HOURS * 60 * 60,
    ...(domain ? { domain } : {}),
  }
}
