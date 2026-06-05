// Rate limit em memória (single-process). Suporta 2 modos:
//
//   1. Hard limit fixo: limite N falhas/janela; após estourar, 429 até janela
//      expirar. Usado pra "guarda do IP" (anti-enumeração).
//
//   2. Backoff progressivo: cada falha adiciona delay até a próxima tentativa
//      (1-3 sem delay, 4=30s, 5=60s, 6=180s, 7+=300s). Usado pra par (IP, email)
//      no login — login legítimo que errou 2-3x mal sente, ataque desacelera.
//
// Em produção single-fork (PM2), o Map vive no processo. Restart zera tudo —
// trade-off aceitável pra escala atual (Redis fica pra quando escalar).
//
// Funções deste módulo NUNCA throwam. Em qualquer erro silencioso, retornam
// `allowed: true` (fail-open) — política: rate limit NUNCA deve impedir um
// login legítimo. Segurança real é bcrypt + audit + timing, não esse limiter.

interface Entry {
  failures: number
  lastFailureAt: number
  windowResetAt: number
}

const store = new Map<string, Entry>()

// ────────────────────────────────────────────────────────────────────────────
// HARD LIMIT (anti-enumeração por IP) — modo legado, mantido pra compat
// ────────────────────────────────────────────────────────────────────────────

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterMs: number
  failures: number
}

/**
 * Hard limit por janela fixa. Chamada legada usada em testes existentes:
 * incrementa contador no check. Não pra novo login — use checkBackoff +
 * recordFailure separados.
 */
export function rateLimit(
  key: string,
  limit = 10,
  windowMs = 60_000,
): RateLimitResult {
  try {
    const now = Date.now()
    const entry = store.get(key)

    if (!entry || now > entry.windowResetAt) {
      store.set(key, { failures: 1, lastFailureAt: now, windowResetAt: now + windowMs })
      return { allowed: true, remaining: limit - 1, retryAfterMs: 0, failures: 1 }
    }

    if (entry.failures >= limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: entry.windowResetAt - now,
        failures: entry.failures,
      }
    }

    entry.failures += 1
    entry.lastFailureAt = now
    return {
      allowed: true,
      remaining: limit - entry.failures,
      retryAfterMs: 0,
      failures: entry.failures,
    }
  } catch {
    return { allowed: true, remaining: 999, retryAfterMs: 0, failures: 0 }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// BACKOFF PROGRESSIVO (par IP+email no login)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Tabela de delay por número de falhas consecutivas.
 *   1-3 falhas: 0s   (usuário legítimo errando senha não sente)
 *   4ª:        30s
 *   5ª:        60s
 *   6ª:       180s (3 min)
 *   7ª+:      300s (5 min — teto, não cresce mais)
 */
export function backoffDelayMsForFailures(failures: number): number {
  if (failures <= 3) return 0
  if (failures === 4) return 30_000
  if (failures === 5) return 60_000
  if (failures === 6) return 180_000
  return 300_000
}

/**
 * Verifica se a próxima tentativa nessa chave está permitida AGORA, sem
 * incrementar o contador. Janela de 15 min após a última falha — se passou,
 * trata como zerado.
 */
export function checkBackoff(
  key: string,
  windowMs = 15 * 60_000,
  nowOverride?: number,
): RateLimitResult {
  try {
    const now = nowOverride ?? Date.now()
    const entry = store.get(key)
    if (!entry || now > entry.windowResetAt) {
      return { allowed: true, remaining: 999, retryAfterMs: 0, failures: 0 }
    }
    const delay = backoffDelayMsForFailures(entry.failures)
    if (delay === 0) {
      return { allowed: true, remaining: 999, retryAfterMs: 0, failures: entry.failures }
    }
    const nextAllowedAt = entry.lastFailureAt + delay
    if (now >= nextAllowedAt) {
      return { allowed: true, remaining: 999, retryAfterMs: 0, failures: entry.failures }
    }
    void windowMs
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: nextAllowedAt - now,
      failures: entry.failures,
    }
  } catch {
    return { allowed: true, remaining: 999, retryAfterMs: 0, failures: 0 }
  }
}

/**
 * Marca uma falha. Cria entry se não existir; incrementa contador; estende
 * a janela pra que tentativas espaçadas não escapem.
 */
export function recordFailure(key: string, windowMs = 15 * 60_000): void {
  try {
    const now = Date.now()
    const entry = store.get(key)
    if (!entry || now > entry.windowResetAt) {
      store.set(key, { failures: 1, lastFailureAt: now, windowResetAt: now + windowMs })
      return
    }
    entry.failures += 1
    entry.lastFailureAt = now
    entry.windowResetAt = now + windowMs
  } catch {
    // fail-open silencioso
  }
}

/**
 * Reset total do contador. Chamada após login bem-sucedido pra zerar o
 * bucket (IP, email) do usuário legítimo.
 */
export function resetAttempts(key: string): void {
  try {
    store.delete(key)
  } catch {
    // fail-open
  }
}

/** Acesso pra testes — não usar em produção. */
export function __clearAllForTests(): void {
  store.clear()
}

// ────────────────────────────────────────────────────────────────────────────
// KEY BUILDERS
// ────────────────────────────────────────────────────────────────────────────

/**
 * Extrai IP do request (X-Forwarded-For do nginx, depois X-Real-IP). Fallback
 * pra 'unknown' (ainda funcional — todos os fallbacks compartilham bucket,
 * mas é caso raro de header faltante).
 */
export function getRequestIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  )
}

/** Mantido pra compatibilidade — usado por outros endpoints fora do login. */
export function rateLimitKey(request: Request, prefix: string): string {
  return `${prefix}:${getRequestIp(request)}`
}

/** Chave composta IP + email pra backoff progressivo do login. */
export function loginBackoffKey(ip: string, email: string): string {
  const norm = (email ?? '').trim().toLowerCase() || '_anon'
  return `login:${ip}:${norm}`
}

/** Chave da guarda do IP (segundo limit hard pra anti-enumeração). */
export function loginIpGuardKey(ip: string): string {
  return `login-ip-guard:${ip}`
}
