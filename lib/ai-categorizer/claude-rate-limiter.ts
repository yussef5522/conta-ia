// Rate limiter por empresa pra chamadas Claude — Fase 3 Etapa 3.
// Camada 3 do Pipeline IA Contadora.
//
// 2 janelas:
//   - 10 calls / minuto (defesa contra loop runaway)
//   - 1000 calls / dia  (custo cap ~ $8/dia/empresa)
//
// Conta apenas claudeApiCalled=true (cache hits NÃO contam).
// Limites configuráveis via env: AI_CLAUDE_MAX_PER_MIN, AI_CLAUDE_MAX_PER_DAY.

import { prisma } from '@/lib/db'

export interface RateLimitResult {
  allowed: boolean
  // Razão da rejeição (null quando allowed=true)
  reason: 'over-minute' | 'over-day' | null
  // Mensagem amigável em pt-BR pra mostrar no UI
  message?: string
  // Pra UI: contadores atuais
  countPerMinute: number
  countPerDay: number
  // Pra UI: limites configurados
  limitPerMinute: number
  limitPerDay: number
}

function envInt(name: string, fallback: number): number {
  const v = process.env[name]
  if (!v) return fallback
  const n = parseInt(v, 10)
  return isNaN(n) || n <= 0 ? fallback : n
}

export function getRateLimits(): { perMinute: number; perDay: number } {
  return {
    perMinute: envInt('AI_CLAUDE_MAX_PER_MIN', 10),
    perDay: envInt('AI_CLAUDE_MAX_PER_DAY', 1000),
  }
}

export async function checkRateLimit(
  companyId: string,
  now: Date = new Date(),
): Promise<RateLimitResult> {
  if (!companyId) {
    throw new Error('companyId obrigatório (isolamento multi-tenant)')
  }

  const { perMinute, perDay } = getRateLimits()
  const oneMinuteAgo = new Date(now.getTime() - 60 * 1000)
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  // 2 queries paralelas — janelas diferentes
  const [countPerMinute, countPerDay] = await Promise.all([
    prisma.aiUsageLog.count({
      where: {
        companyId,
        claudeApiCalled: true,
        createdAt: { gte: oneMinuteAgo },
      },
    }),
    prisma.aiUsageLog.count({
      where: {
        companyId,
        claudeApiCalled: true,
        createdAt: { gte: oneDayAgo },
      },
    }),
  ])

  if (countPerMinute >= perMinute) {
    return {
      allowed: false,
      reason: 'over-minute',
      message: `Limite de ${perMinute} sugestões IA por minuto atingido. Aguarde alguns segundos e tente novamente.`,
      countPerMinute,
      countPerDay,
      limitPerMinute: perMinute,
      limitPerDay: perDay,
    }
  }

  if (countPerDay >= perDay) {
    return {
      allowed: false,
      reason: 'over-day',
      message: `Limite diário de ${perDay} sugestões IA atingido. Volta amanhã ou classifique manualmente.`,
      countPerMinute,
      countPerDay,
      limitPerMinute: perMinute,
      limitPerDay: perDay,
    }
  }

  return {
    allowed: true,
    reason: null,
    countPerMinute,
    countPerDay,
    limitPerMinute: perMinute,
    limitPerDay: perDay,
  }
}

// Registra uso (chamado pelo orchestrador). Best-effort: falha aqui não
// quebra o fluxo do user.
export async function logUsage(params: {
  companyId: string
  userId?: string | null
  transactionId?: string | null
  claudeApiCalled: boolean
  inputTokens: number
  outputTokens: number
  costCents: number
  cacheHit: boolean
}): Promise<void> {
  try {
    await prisma.aiUsageLog.create({
      data: {
        companyId: params.companyId,
        userId: params.userId ?? null,
        transactionId: params.transactionId ?? null,
        claudeApiCalled: params.claudeApiCalled,
        inputTokens: params.inputTokens,
        outputTokens: params.outputTokens,
        costCents: params.costCents,
        cacheHit: params.cacheHit,
      },
    })
  } catch (err) {
    // Sanitize: nunca loga API key. Loga só mensagem genérica.
    console.error('[AI_USAGE_LOG] falha persist:', err instanceof Error ? err.message : 'erro')
  }
}
