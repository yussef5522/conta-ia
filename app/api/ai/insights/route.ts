// Hotfix 5.0.4.0c1-fix — Endpoint POST /api/ai/insights.
//
// REFATORADO:
// - Body novo: { empresaId, startDate, endDate, compareStartDate?, compareEndDate?, force? }
// - Modo automático via inferMode (comparative | evolution | single)
// - Validação 12 meses no backend
// - Cache key inclui modo + 4 datas
//
// Fluxo:
// 1. Auth + permission check
// 2. Validação Zod + limite 12 meses
// 3. Infere modo
// 4. Lookup cache (skip se force=true)
// 5. Coleta dados (dispatcher por modo)
// 6. Chama Claude Sonnet 4.6
// 7. Persiste log
// 8. Retorna insights + metadata

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { collectInsightData } from '@/lib/ai/collect-insight-data'
import { callInsightsAPI, INSIGHTS_MODEL } from '@/lib/ai/insights-client'
import {
  lookupInsightsCache,
  saveInsightsLog,
} from '@/lib/ai/insights-cache'
import {
  inferMode,
  validatePeriodLimit,
} from '@/lib/dates/period-presets'

export const runtime = 'nodejs'
export const maxDuration = 60

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD esperado')
const FEATURE = 'monthly-insights'

const bodySchema = z
  .object({
    empresaId: z.string().min(1),
    startDate: isoDate,
    endDate: isoDate,
    compareStartDate: isoDate.optional(),
    compareEndDate: isoDate.optional(),
    force: z.boolean().optional(),
  })
  .refine(
    (b) =>
      (b.compareStartDate && b.compareEndDate) ||
      (!b.compareStartDate && !b.compareEndDate),
    {
      message:
        'compareStartDate e compareEndDate precisam vir juntos ou nenhum dos dois',
    },
  )

export async function POST(request: NextRequest) {
  try {
    const body = bodySchema.parse(await request.json())

    const ctx = await getAuthContext(request, body.empresaId)
    ctx.requirePermission('dre.view')

    // Validação 12 meses no período principal
    const limit = validatePeriodLimit(body.startDate, body.endDate, 12)
    if (!limit.ok) {
      return NextResponse.json({ error: limit.error }, { status: 400 })
    }

    // Validação compare period (também 12m max)
    if (body.compareStartDate && body.compareEndDate) {
      const cmpLimit = validatePeriodLimit(
        body.compareStartDate,
        body.compareEndDate,
        12,
      )
      if (!cmpLimit.ok) {
        return NextResponse.json(
          { error: `Período de comparação: ${cmpLimit.error}` },
          { status: 400 },
        )
      }
    }

    const mode = inferMode({
      startDate: body.startDate,
      endDate: body.endDate,
      compareStartDate: body.compareStartDate,
      compareEndDate: body.compareEndDate,
    })

    // 1. Tentar cache (skip se force=true)
    if (!body.force) {
      const cached = await lookupInsightsCache({
        companyId: body.empresaId,
        feature: FEATURE,
        mode,
        startDate: body.startDate,
        endDate: body.endDate,
        compareStartDate: body.compareStartDate ?? null,
        compareEndDate: body.compareEndDate ?? null,
      })
      if (cached) {
        return NextResponse.json({
          insights: cached.insights,
          mode,
          period: { start: body.startDate, end: body.endDate },
          comparePeriod:
            body.compareStartDate && body.compareEndDate
              ? { start: body.compareStartDate, end: body.compareEndDate }
              : null,
          cacheHit: true,
          cachedAt: cached.cachedAt,
        })
      }
    }

    // 2. Coleta dados
    const inputData = await collectInsightData({
      empresaId: body.empresaId,
      startDate: body.startDate,
      endDate: body.endDate,
      compareStartDate: body.compareStartDate,
      compareEndDate: body.compareEndDate,
    })

    // 3. Chama Claude
    const startTime = Date.now()
    const result = await callInsightsAPI(inputData)
    const elapsedMs = Date.now() - startTime

    const logBase = {
      companyId: body.empresaId,
      userId: ctx.user.id,
      feature: FEATURE,
      model: INSIGHTS_MODEL,
      mode,
      currentPeriod: body.startDate,
      currentEndPeriod: body.endDate,
      basePeriod: body.compareStartDate ?? null,
      baseEndPeriod: body.compareEndDate ?? null,
      elapsedMs,
    }

    if (result.kind === 'disabled') {
      return NextResponse.json(
        { error: 'IA temporariamente indisponível. Tente novamente.' },
        { status: 503 },
      )
    }

    if (result.kind === 'rate-limited') {
      return NextResponse.json(
        { error: 'Muitas chamadas à IA. Aguarde 1 minuto e tente de novo.' },
        { status: 429 },
      )
    }

    if (result.kind === 'invalid-json') {
      await saveInsightsLog({
        ...logBase,
        inputTokens: 0,
        outputTokens: 0,
        costCents: 0,
        errorMessage: 'invalid-json',
      })
      return NextResponse.json(
        {
          error:
            'A IA retornou uma resposta em formato inválido. Tente gerar novamente.',
        },
        { status: 502 },
      )
    }

    if (result.kind === 'error') {
      await saveInsightsLog({
        ...logBase,
        inputTokens: 0,
        outputTokens: 0,
        costCents: 0,
        errorMessage: result.message,
      })
      return NextResponse.json(
        {
          error:
            'Não foi possível gerar a análise agora. Tente novamente em alguns minutos.',
        },
        { status: 500 },
      )
    }

    if (result.kind === 'cache-hit') {
      // Não deveria acontecer aqui (cache externo), mas defesa
      return NextResponse.json({
        insights: result.insights,
        mode,
        period: { start: body.startDate, end: body.endDate },
        comparePeriod:
          body.compareStartDate && body.compareEndDate
            ? { start: body.compareStartDate, end: body.compareEndDate }
            : null,
        cacheHit: true,
      })
    }

    // success — persiste + retorna
    await saveInsightsLog({
      ...logBase,
      inputTokens: result.tokensUsed?.input ?? 0,
      outputTokens: result.tokensUsed?.output ?? 0,
      costCents: result.costCents ?? 0,
      insights: result.insights,
    })

    return NextResponse.json({
      insights: result.insights,
      mode,
      period: { start: body.startDate, end: body.endDate },
      comparePeriod:
        body.compareStartDate && body.compareEndDate
          ? { start: body.compareStartDate, end: body.compareEndDate }
          : null,
      cacheHit: false,
      elapsedMs,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
