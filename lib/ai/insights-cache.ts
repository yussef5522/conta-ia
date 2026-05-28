// Sprint 5.0.4.0c1 — Cache de insights via DB (AiInsightsLog).
//
// Pattern:
// - Lookup: SELECT mais recente que satisfaça (companyId, feature, periods)
//   E createdAt > now - 1h E responseJson IS NOT NULL
// - Save: INSERT novo row a cada chamada (sucesso ou erro)
//
// Não fazemos UPDATE — cada chamada vira uma linha histórica auditável.

import { prisma } from '@/lib/db'
import type { InsightOutput } from './insights-types'

const CACHE_TTL_MS = 60 * 60 * 1000 // 1h

export interface CacheLookupParams {
  companyId: string
  feature: string
  currentPeriod: string
  basePeriod: string
}

export interface CachedInsight {
  insights: InsightOutput
  cachedAt: Date
  costCents: number
}

export async function lookupInsightsCache(
  params: CacheLookupParams,
): Promise<CachedInsight | null> {
  const cutoff = new Date(Date.now() - CACHE_TTL_MS)

  const cached = await prisma.aiInsightsLog.findFirst({
    where: {
      companyId: params.companyId,
      feature: params.feature,
      currentPeriod: params.currentPeriod,
      basePeriod: params.basePeriod,
      responseJson: { not: null },
      errorMessage: null,
      createdAt: { gte: cutoff },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      responseJson: true,
      createdAt: true,
      costCents: true,
    },
  })

  if (!cached || !cached.responseJson) return null

  try {
    const insights = JSON.parse(cached.responseJson) as InsightOutput
    return {
      insights,
      cachedAt: cached.createdAt,
      costCents: cached.costCents,
    }
  } catch {
    return null
  }
}

export interface SaveLogParams {
  companyId: string
  userId: string | null
  feature: string
  model: string
  currentPeriod: string
  basePeriod: string
  inputTokens: number
  outputTokens: number
  costCents: number
  elapsedMs: number
  insights?: InsightOutput
  errorMessage?: string
}

export async function saveInsightsLog(params: SaveLogParams): Promise<void> {
  await prisma.aiInsightsLog.create({
    data: {
      companyId: params.companyId,
      userId: params.userId,
      feature: params.feature,
      model: params.model,
      currentPeriod: params.currentPeriod,
      basePeriod: params.basePeriod,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      costCents: params.costCents,
      elapsedMs: params.elapsedMs,
      responseJson: params.insights ? JSON.stringify(params.insights) : null,
      errorMessage: params.errorMessage ?? null,
    },
  })
}
