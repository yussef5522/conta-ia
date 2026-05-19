// Rate limit pro login admin — Sprint 1.6.
// 5 tentativas / 15 min POR IP (anti-brute force).
// Sugestão Yussef: por IP, não por email — evita bypass com emails diferentes.

import { rateLimit, rateLimitKey } from '@/lib/rate-limit'

export const ADMIN_LOGIN_MAX_ATTEMPTS = 5
export const ADMIN_LOGIN_WINDOW_MS = 15 * 60 * 1000

export interface AdminLoginRateLimitResult {
  allowed: boolean
  retryAfterMs: number
  retryAfterMinutes: number
}

export function checkAdminLoginRateLimit(
  request: Request,
): AdminLoginRateLimitResult {
  const key = rateLimitKey(request, 'admin-login')
  const r = rateLimit(key, ADMIN_LOGIN_MAX_ATTEMPTS, ADMIN_LOGIN_WINDOW_MS)
  return {
    allowed: r.allowed,
    retryAfterMs: r.retryAfterMs,
    retryAfterMinutes: Math.max(1, Math.ceil(r.retryAfterMs / 60_000)),
  }
}
