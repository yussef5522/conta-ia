// Sprint Asaas FATIA 3C (02/06/2026) — Webhook helpers (funções PURAS).
//
// Sem deps de Prisma/fetch/DB. Testáveis sem env.
//
// Decisões de produto (aprovadas Yussef 02/06/2026):
//   1. CHARGEBACK_REQUESTED → PAST_DUE (não cancela imediato)
//   2. SUBSCRIPTION_* todos IGNORADOS (gravados pra auditoria)
//   3. Sem filtro de IP no MVP — token protege
//   4. Síncrono no MVP (sem fila)
//   5. gatewaySubscriptionId set lazy na 1ª confirmação

import { timingSafeEqual } from 'crypto'
import type { WebhookRouteAction } from './types'

// ============================================================
// 1. Validação do header asaas-access-token
// ============================================================

/**
 * Compara token recebido vs esperado em tempo constante (resistente
 * a timing-attack). Retorna false se faltar qualquer um, ou se
 * tamanhos diferentes (timingSafeEqual exige Buffer.length iguais).
 *
 * Nunca loga o token recebido — chamadores devem só logar `auth fail`
 * com path e env, sem expor o que veio.
 */
export function validateAsaasToken(
  received: string | null | undefined,
  expected: string | null | undefined,
): boolean {
  if (!received || !expected) return false
  const r = Buffer.from(received, 'utf-8')
  const e = Buffer.from(expected, 'utf-8')
  if (r.length !== e.length) return false
  return timingSafeEqual(r, e)
}

// ============================================================
// 2. Parser do externalReference
// ============================================================

export interface ParsedExternalReference {
  userId: string
  planId: string
  ciclo: 'MONTHLY' | 'YEARLY'
  // Dias de acesso pra Pix one-off (não recorrente).
  dias?: number
}

/**
 * Parser do nosso externalReference (formato definido em 3B):
 *   "user:<id>|plan:<planId>|ciclo:<MONTHLY|YEARLY>"
 *   "user:<id>|plan:<planId>|ciclo:<MONTHLY|YEARLY>|dias:<N>"  (Pix)
 *
 * Retorna null se formato inválido / faltam campos / valores inválidos.
 */
export function parseExternalReference(
  raw: string | null | undefined,
): ParsedExternalReference | null {
  if (!raw || typeof raw !== 'string') return null

  const parts = raw.split('|')
  const segments: Record<string, string> = {}
  for (const part of parts) {
    const idx = part.indexOf(':')
    if (idx < 0) return null
    const key = part.slice(0, idx).trim()
    const value = part.slice(idx + 1).trim()
    if (!key || !value) return null
    segments[key] = value
  }

  const userId = segments.user
  const planId = segments.plan
  const ciclo = segments.ciclo
  if (!userId || !planId || !ciclo) return null
  if (ciclo !== 'MONTHLY' && ciclo !== 'YEARLY') return null

  const parsed: ParsedExternalReference = { userId, planId, ciclo }
  if (segments.dias) {
    const n = Number(segments.dias)
    if (!Number.isInteger(n) || n <= 0) return null
    parsed.dias = n
  }
  return parsed
}

// ============================================================
// 3. Cálculo de currentPeriodEnd
// ============================================================

/**
 * Calcula o NOVO currentPeriodEnd a partir do atual + ciclo.
 *
 * Regra crítica (aprovada): max(now, current) + delta.
 * - Renovação antecipada NÃO retrocede o período.
 * - Primeira ativação (current=null) usa `now`.
 *
 * MONTHLY: +1 mês (preserva dia, ajustando pra último dia do mês alvo
 *          quando original > dias no mês alvo — ex: 31/01 → 28/02).
 * YEARLY:  +1 ano (preserva mês/dia, ajustando 29/02 → 28/02 fora
 *          de ano bissexto).
 */
export function calculateNextPeriodEnd(
  current: Date | null,
  ciclo: 'MONTHLY' | 'YEARLY',
  now: Date,
): Date {
  const base = !current || current.getTime() < now.getTime() ? now : current
  return ciclo === 'YEARLY' ? addYears(base, 1) : addMonths(base, 1)
}

/** Soma N meses preservando UTC. Ajusta pra último dia se mês alvo é menor. */
function addMonths(d: Date, n: number): Date {
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth()
  const day = d.getUTCDate()
  // Cria com dia 1 do mês alvo, depois ajusta pro dia desejado (capped)
  const target = new Date(Date.UTC(y, m + n, 1, d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds()))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(day, lastDay))
  return target
}

function addYears(d: Date, n: number): Date {
  return addMonths(d, n * 12)
}

// ============================================================
// 4. Roteamento evento → ação
// ============================================================

/**
 * Mapa de evento Asaas → ação na nossa Subscription.
 *
 * Não-mapeados (PAYMENT_CREATED, SUBSCRIPTION_*, etc) → IGNORE
 * (gravados em WebhookEvent com status=IGNORED pra auditoria).
 */
export function routeEvent(event: string): WebhookRouteAction {
  switch (event) {
    case 'PAYMENT_CONFIRMED':
    case 'PAYMENT_RECEIVED':
      return 'ACTIVATE'

    case 'PAYMENT_OVERDUE':
    case 'PAYMENT_CHARGEBACK_REQUESTED':
      return 'PAST_DUE'

    case 'PAYMENT_REFUNDED':
    case 'PAYMENT_DELETED':
      return 'CANCEL'

    default:
      return 'IGNORE'
  }
}
