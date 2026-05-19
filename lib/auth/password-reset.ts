// Helpers do fluxo "Esqueci senha" — Sprint 1.5.
// PUROS (sem Prisma) — testáveis sem DB.

import { randomInt, createHash } from 'crypto'
import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'

export const CODE_LENGTH = 6
export const CODE_EXPIRES_MIN = 15
export const RESET_TOKEN_EXPIRES_MIN = 15

// Gera código 6 dígitos com leading zeros ("048293")
export function generateResetCode(): string {
  const n = randomInt(0, 1_000_000)
  return String(n).padStart(CODE_LENGTH, '0')
}

// Hint visível pro user pra confirmar qual email recebeu ("04****")
export function codeHint(code: string): string {
  if (code.length !== CODE_LENGTH) return ''
  return `${code.slice(0, 2)}****`
}

// Hash bcrypt do código (mesmo rounds da senha pra consistência)
export async function hashCode(code: string): Promise<string> {
  return bcrypt.hash(code, 10)
}

export async function verifyCode(
  code: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(code, hash)
}

// ============================================================
// JWT scope=password-reset
// ============================================================
//
// Token de 15min emitido APÓS verificação correta do código.
// User troca esse token por uma chamada POST /reset-password.
// Scope diferente do JWT de sessão (não pode ser usado pra logar).

const SCOPE = 'password-reset'

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET não configurado')
  return new TextEncoder().encode(secret)
}

export interface ResetTokenPayload {
  sub: string // userId
  email: string
  scope: 'password-reset'
  jti: string // unique pra invalidar
}

export async function signResetToken(payload: {
  sub: string
  email: string
}): Promise<string> {
  const secret = getSecret()
  const jti = createHash('sha256')
    .update(`${payload.sub}:${Date.now()}:${Math.random()}`)
    .digest('hex')
    .slice(0, 16)
  return new SignJWT({ ...payload, scope: SCOPE, jti })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${RESET_TOKEN_EXPIRES_MIN}m`)
    .sign(secret)
}

export async function verifyResetToken(
  token: string,
): Promise<ResetTokenPayload> {
  const secret = getSecret()
  const { payload } = await jwtVerify(token, secret)
  if (payload.scope !== SCOPE) {
    throw new Error('Token com escopo inválido')
  }
  if (!payload.sub || typeof payload.email !== 'string') {
    throw new Error('Token mal formado')
  }
  return {
    sub: String(payload.sub),
    email: payload.email,
    scope: SCOPE,
    jti: typeof payload.jti === 'string' ? payload.jti : '',
  }
}

// ============================================================
// Validação de senha forte (server-side)
// ============================================================

export interface PasswordStrength {
  ok: boolean
  errors: string[]
  level: 'weak' | 'medium' | 'strong'
}

export function checkPasswordStrength(password: string): PasswordStrength {
  const errors: string[] = []
  if (password.length < 8) {
    errors.push('Senha precisa ter ao menos 8 caracteres')
  }
  if (!/[A-Za-z]/.test(password)) {
    errors.push('Inclua ao menos 1 letra')
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Inclua ao menos 1 número')
  }

  const has8 = password.length >= 8
  const hasLetter = /[A-Za-z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const hasUpper = /[A-Z]/.test(password)
  const hasSpecial = /[^A-Za-z0-9]/.test(password)
  const long = password.length >= 12

  let level: 'weak' | 'medium' | 'strong' = 'weak'
  if (has8 && hasLetter && hasNumber) {
    level = 'medium'
    if (long && hasUpper && hasSpecial) level = 'strong'
    else if (hasUpper || hasSpecial) level = 'medium'
  }

  return { ok: errors.length === 0, errors, level }
}
