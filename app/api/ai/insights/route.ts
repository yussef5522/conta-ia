// Sprint 5.0.4.0c1 Fase 4 — Endpoint POST /api/ai/insights.
//
// Body: { empresaId, currentPeriod, basePeriod, force?: boolean }
//
// Fluxo:
// 1. Auth + permission check
// 2. Lookup cache (skip se force=true)
// 3. Coleta dados (DRE atual + base + variâncias + top categorias)
// 4. Chama Claude Sonnet 4.6
// 5. Persiste log (sucesso ou erro)
// 6. Retorna insights

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

export const runtime = 'nodejs'
// Sonnet 4.6 pode levar 10-25s
export const maxDuration = 60

const ymRegex = /^\d{4}-\d{2}$/
const FEATURE = 'monthly-insights'

const bodySchema = z.object({
  empresaId: z.string().min(1),
  currentPeriod: z.string().regex(ymRegex),
  basePeriod: z.string().regex(ymRegex),
  force: z.boolean().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = bodySchema.parse(await request.json())

    const ctx = await getAuthContext(request, body.empresaId)
    ctx.requirePermission('dre.view')

    if (body.currentPeriod === body.basePeriod) {
      return NextResponse.json(
        { error: 'Períodos atual e base não podem ser iguais' },
        { status: 400 },
      )
    }

    // 1. Tentar cache (skip se force=true)
    if (!body.force) {
      const cached = await lookupInsightsCache({
        companyId: body.empresaId,
        feature: FEATURE,
        currentPeriod: body.currentPeriod,
        basePeriod: body.basePeriod,
      })
      if (cached) {
        return NextResponse.json({
          insights: cached.insights,
          cacheHit: true,
          cachedAt: cached.cachedAt,
        })
      }
    }

    // 2. Coleta dados
    const inputData = await collectInsightData({
      empresaId: body.empresaId,
      currentPeriod: body.currentPeriod,
      basePeriod: body.basePeriod,
    })

    // 3. Chama Claude
    const startTime = Date.now()
    const result = await callInsightsAPI(inputData)
    const elapsedMs = Date.now() - startTime

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
        companyId: body.empresaId,
        userId: ctx.user.id,
        feature: FEATURE,
        model: INSIGHTS_MODEL,
        currentPeriod: body.currentPeriod,
        basePeriod: body.basePeriod,
        inputTokens: 0,
        outputTokens: 0,
        costCents: 0,
        elapsedMs,
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
        companyId: body.empresaId,
        userId: ctx.user.id,
        feature: FEATURE,
        model: INSIGHTS_MODEL,
        currentPeriod: body.currentPeriod,
        basePeriod: body.basePeriod,
        inputTokens: 0,
        outputTokens: 0,
        costCents: 0,
        elapsedMs,
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

    // result.kind === 'success' | 'cache-hit'
    if (result.kind === 'cache-hit') {
      // Não deveria acontecer aqui (cache externo), mas tratado
      return NextResponse.json({
        insights: result.insights,
        cacheHit: true,
      })
    }

    // success — persiste log + retorna
    await saveInsightsLog({
      companyId: body.empresaId,
      userId: ctx.user.id,
      feature: FEATURE,
      model: INSIGHTS_MODEL,
      currentPeriod: body.currentPeriod,
      basePeriod: body.basePeriod,
      inputTokens: result.tokensUsed?.input ?? 0,
      outputTokens: result.tokensUsed?.output ?? 0,
      costCents: result.costCents ?? 0,
      elapsedMs,
      insights: result.insights,
    })

    return NextResponse.json({
      insights: result.insights,
      cacheHit: false,
      elapsedMs,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
