// Hotfix 5.0.4.0c1-fix — Cache de insights via DB (AiInsightsLog).
//
// REFATORADO: cache key inclui mode + 4 datas (start/end principal + start/end compare).
//
// Pattern:
// - Lookup: SELECT mais recente que satisfaça (companyId, feature, mode, 4 datas)
//   E createdAt > now - 1h E responseJson IS NOT NULL
// - Save: INSERT novo row a cada chamada (sucesso ou erro) — histórico auditável

import { prisma } from '@/lib/db'
import type { InsightOutput } from './insights-types'
import type { InsightMode } from '@/lib/dates/period-presets'

const CACHE_TTL_MS = 60 * 60 * 1000 // 1h

export interface CacheLookupParams {
  companyId: string
  feature: string
  mode: InsightMode
  /** YYYY-MM-DD */
  startDate: string
  endDate: string
  compareStartDate: string | null
  compareEndDate: string | null
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
      mode: params.mode,
      currentPeriod: params.startDate,
      currentEndPeriod: params.endDate,
      basePeriod: params.compareStartDate,
      baseEndPeriod: params.compareEndDate,
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
  mode: InsightMode
  currentPeriod: string
  currentEndPeriod: string
  basePeriod: string | null
  baseEndPeriod: string | null
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
      mode: params.mode,
      currentPeriod: params.currentPeriod,
      currentEndPeriod: params.currentEndPeriod,
      basePeriod: params.basePeriod,
      baseEndPeriod: params.baseEndPeriod,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      costCents: params.costCents,
      elapsedMs: params.elapsedMs,
      responseJson: params.insights ? JSON.stringify(params.insights) : null,
      errorMessage: params.errorMessage ?? null,
    },
  })
}
