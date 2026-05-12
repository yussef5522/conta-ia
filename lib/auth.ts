import { SignJWT, jwtVerify } from 'jose'
import { type NextRequest } from 'next/server'

export interface TokenPayload {
  sub: string
  email: string
  name: string
  role: string
}

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET não configurado')
  return new TextEncoder().encode(secret)
}

export async function signToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1d')
    .sign(getSecret())
}

export async function verifyToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, getSecret())
  return payload as unknown as TokenPayload
}

export async function getAuthUser(request: NextRequest): Promise<TokenPayload | null> {
  const token = request.cookies.get('auth_token')?.value
  if (!token) return null
  try {
    return await verifyToken(token)
  } catch {
    return null
  }
}

export const COOKIE_NAME = 'auth_token'

// COOKIE_SECURE override: por padrão, secure=true em produção (HTTPS only).
// Quando o servidor ainda não tem SSL configurado (ex: pré-DNS/Let's Encrypt),
// definir COOKIE_SECURE=false no .env permite o cookie persistir sobre HTTP.
// Default mantém comportamento seguro: prod = secure, dev = insecure.
const cookieSecure =
  process.env.COOKIE_SECURE !== undefined
    ? process.env.COOKIE_SECURE === 'true'
    : process.env.NODE_ENV === 'production'

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: cookieSecure,
  sameSite: 'lax' as const,
  maxAge: 60 * 60 * 24,
  path: '/',
}
