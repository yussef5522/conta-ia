// Rate limits específicos do fluxo "Esqueci senha" — Sprint 1.5.
//
// Reusa rateLimit() in-memory de lib/rate-limit.ts (Sprint 1.2).
// 3 camadas independentes:
//   1. forgot-password:request:<email> — 3 solicitações / 15 min (anti-spam)
//   2. forgot-password:resend:<email>  — 1 reenvio / 60 segundos
//   3. forgot-password:verify:<email>  — 10 verificações / 15 min (anti-spray)
//
// MAX_CODE_ATTEMPTS_PER_CODE = 5 é uma trava DIFERENTE, persistida em
// PasswordResetCode.attempts (não em memória). Cada código tem 5 chances.

import { rateLimit } from '@/lib/rate-limit'

export const REQUEST_LIMIT = 3
export const REQUEST_WINDOW_MS = 15 * 60 * 1000

export const RESEND_LIMIT = 1
export const RESEND_WINDOW_MS = 60 * 1000

export const VERIFY_LIMIT = 10
export const VERIFY_WINDOW_MS = 15 * 60 * 1000

// Por-código (persistido no DB): 5 chances pra inserir o código correto
export const MAX_CODE_ATTEMPTS_PER_CODE = 5

export interface RateLimitCheck {
  allowed: boolean
  retryAfterSeconds: number
  reason?: 'request' | 'resend' | 'verify'
  message?: string
}

export function checkRequestLimit(email: string): RateLimitCheck {
  const r = rateLimit(
    `forgot-password:request:${email.toLowerCase()}`,
    REQUEST_LIMIT,
    REQUEST_WINDOW_MS,
  )
  if (r.allowed) {
    return { allowed: true, retryAfterSeconds: 0 }
  }
  const minutes = Math.max(1, Math.ceil(r.retryAfterMs / 60_000))
  return {
    allowed: false,
    retryAfterSeconds: Math.ceil(r.retryAfterMs / 1000),
    reason: 'request',
    message: `Muitas solicitações de redefinição. Tente novamente em ${minutes} minuto${minutes === 1 ? '' : 's'}.`,
  }
}

export function checkResendLimit(email: string): RateLimitCheck {
  const r = rateLimit(
    `forgot-password:resend:${email.toLowerCase()}`,
    RESEND_LIMIT,
    RESEND_WINDOW_MS,
  )
  if (r.allowed) return { allowed: true, retryAfterSeconds: 0 }
  return {
    allowed: false,
    retryAfterSeconds: Math.ceil(r.retryAfterMs / 1000),
    reason: 'resend',
    message: `Aguarde ${Math.max(1, Math.ceil(r.retryAfterMs / 1000))} segundos pra reenviar.`,
  }
}

export function checkVerifyLimit(email: string): RateLimitCheck {
  const r = rateLimit(
    `forgot-password:verify:${email.toLowerCase()}`,
    VERIFY_LIMIT,
    VERIFY_WINDOW_MS,
  )
  if (r.allowed) return { allowed: true, retryAfterSeconds: 0 }
  return {
    allowed: false,
    retryAfterSeconds: Math.ceil(r.retryAfterMs / 1000),
    reason: 'verify',
    message: `Muitas tentativas de verificação. Tente novamente em alguns minutos.`,
  }
}
