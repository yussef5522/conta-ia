// Sprint 5.0.2.d — POST análise tributária com Claude.
//
// Fluxo:
//   1. Auth + permission check
//   2. Carrega dados reais (loadCompanyTaxData)
//   3. Edge cases (sem CNAE / sem transactions / sem perfil)
//   4. Cache key sha256 do snapshot relevante → consulta cache 24h
//   5. Se cache miss: chama Claude → persiste com TTL 24h
//   6. Retorna analysis + metadata + fromCache flag

import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { loadCompanyTaxData } from '@/lib/tax/ai-analysis/data-aggregator'
import { analyzeTaxOptimization } from '@/lib/tax/ai-analysis/claude-analyzer'

interface Params {
  params: Promise<{ id: string }>
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24h

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.view')

    const data = await loadCompanyTaxData(companyId, 12)

    // Edge case: sem CNAE configurado
    if (!data.cnae) {
      return NextResponse.json(
        {
          erro: 'CNAE não configurado',
          mensagem:
            'Configure o CNAE da empresa em Tributário → Configurações pra ativar análise IA.',
          link: '/tributario?tab=config',
        },
        { status: 422 },
      )
    }

    // Edge case: sem transactions
    if (data.financial.receitaTotal === 0 && data.financial.despesaTotal === 0) {
      return NextResponse.json(
        {
          erro: 'Sem dados financeiros',
          mensagem:
            'Importe transações ou cadastre lançamentos pra análise IA usar dados reais.',
        },
        { status: 422 },
      )
    }

    // Cache key — só varia se dados relevantes mudarem
    const cacheKey = createHash('sha256')
      .update(
        JSON.stringify({
          companyId,
          cnae: data.cnae.code,
          regime: data.taxProfile.regime,
          anexo: data.taxProfile.simplesAnexo,
          estado: data.taxProfile.estado,
          receita: Math.round(data.financial.receitaMensalMedia),
          despesa: Math.round(data.financial.despesaMensalMedia),
          folha: Math.round(data.financial.folhaIdentificada),
          periodEnd: data.financial.periodEnd.toISOString().slice(0, 10),
        }),
      )
      .digest('hex')

    // Cache hit
    const cached = await prisma.aiAnalysisCache.findUnique({
      where: { companyId_cacheKey: { companyId, cacheKey } },
    })
    if (cached && cached.expiresAt > new Date()) {
      return NextResponse.json({
        ...JSON.parse(cached.analysis),
        fromCache: true,
        cachedAt: cached.createdAt,
        expiresAt: cached.expiresAt,
        metadata: {
          modeloUsado: cached.modelUsed,
          tokensInput: cached.tokensInput,
          tokensOutput: cached.tokensOutput,
          costUSD: cached.costUSD,
        },
      })
    }

    // Chamar Claude
    const result = await analyzeTaxOptimization(data)

    if (result.kind === 'disabled') {
      return NextResponse.json(
        {
          erro: 'IA desabilitada',
          mensagem: result.reason,
        },
        { status: 503 },
      )
    }

    if (result.kind === 'timeout') {
      return NextResponse.json(
        { erro: 'Timeout', mensagem: 'Análise demorou demais. Tente novamente.' },
        { status: 504 },
      )
    }

    if (result.kind === 'error') {
      return NextResponse.json(
        { erro: 'Falha na análise', mensagem: result.message },
        { status: result.status ?? 500 },
      )
    }

    if (result.kind === 'invalid-json') {
      return NextResponse.json(
        {
          erro: 'Resposta inválida',
          mensagem: 'Claude retornou JSON malformado. Tente novamente.',
          rawText: result.rawText.slice(0, 500),
        },
        { status: 502 },
      )
    }

    if (result.kind === 'max-rounds-exceeded') {
      return NextResponse.json(
        { erro: 'Análise muito complexa', mensagem: 'Excedeu limite de tool rounds.' },
        { status: 504 },
      )
    }

    // Persistir cache
    const expiresAt = new Date(Date.now() + CACHE_TTL_MS)
    await prisma.aiAnalysisCache.upsert({
      where: { companyId_cacheKey: { companyId, cacheKey } },
      create: {
        companyId,
        cacheKey,
        topic: 'general',
        periodStart: data.financial.periodStart,
        periodEnd: data.financial.periodEnd,
        analysis: JSON.stringify(result.analysis),
        modelUsed: result.metadata.modeloUsado,
        tokensInput: result.metadata.tokensInput,
        tokensOutput: result.metadata.tokensOutput,
        costUSD: result.metadata.costUSD,
        expiresAt,
      },
      update: {
        analysis: JSON.stringify(result.analysis),
        modelUsed: result.metadata.modeloUsado,
        tokensInput: result.metadata.tokensInput,
        tokensOutput: result.metadata.tokensOutput,
        costUSD: result.metadata.costUSD,
        expiresAt,
      },
    })

    return NextResponse.json({
      ...result.analysis,
      fromCache: false,
      expiresAt,
      metadata: result.metadata,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
