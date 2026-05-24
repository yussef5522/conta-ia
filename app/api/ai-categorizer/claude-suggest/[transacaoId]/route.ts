// POST /api/ai-categorizer/claude-suggest/[transacaoId]
// Fase 3 Etapa 3 — Camada 3 do Pipeline IA Contadora.
//
// Orquestra:
//   1. Verifica RBAC + acesso à empresa (via getAuthContext)
//   2. Verifica AI_CLAUDE_ENABLED + ANTHROPIC_API_KEY (degrade gracioso)
//   3. Verifica cache (AiClaudeCache) — hit retorna SEM custo
//   4. Verifica rate limit (10/min + 1000/dia por empresa)
//   5. Chama Claude API com few-shot + plano de contas
//   6. Persiste cache + AiUsageLog
//   7. Retorna { suggestion, fromCache, costCents, cacheKey, reasoning }

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import {
  callClaude,
  isClaudeEnabled,
} from '@/lib/ai-categorizer/claude-client'
import {
  getCachedSuggestion,
  putCachedSuggestion,
  computeCacheKey,
} from '@/lib/ai-categorizer/claude-cache'
import {
  checkRateLimit,
  logUsage,
} from '@/lib/ai-categorizer/claude-rate-limiter'

interface Params {
  params: Promise<{ transacaoId: string }>
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { transacaoId } = await params

    // 1. Busca tx + valida ownership
    const tx = await prisma.transaction.findUnique({
      where: { id: transacaoId },
      include: {
        bankAccount: {
          select: {
            companyId: true,
            company: { select: { tradeName: true, name: true, type: true } },
          },
        },
        supplier: { select: { razaoSocial: true } },
      },
    })
    if (!tx) {
      return NextResponse.json(
        { erro: 'Transação não encontrada' },
        { status: 404 },
      )
    }

    const companyId = tx.bankAccount!.companyId
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.view')

    // 2. Feature flag + chave configurada?
    if (!isClaudeEnabled()) {
      return NextResponse.json(
        {
          erro: 'IA Contadora desabilitada',
          detalhe: !process.env.ANTHROPIC_API_KEY
            ? 'ANTHROPIC_API_KEY não configurada no servidor'
            : 'AI_CLAUDE_ENABLED=false',
        },
        { status: 503 },
      )
    }

    // 3. Cache hit?
    const cached = await getCachedSuggestion(companyId, tx.description)
    if (cached) {
      // Log de cache hit (sem custo)
      await logUsage({
        companyId,
        userId: ctx.user.id,
        transactionId: tx.id,
        claudeApiCalled: false,
        inputTokens: 0,
        outputTokens: 0,
        costCents: 0,
        cacheHit: true,
      })
      return NextResponse.json({
        suggestion: cached.suggestion,
        fromCache: true,
        cacheKey: cached.cacheKey,
        costCents: 0,
      })
    }

    // 4. Rate limit
    const rate = await checkRateLimit(companyId)
    if (!rate.allowed) {
      return NextResponse.json(
        {
          erro: rate.message,
          motivo: rate.reason,
          contadores: {
            porMinuto: rate.countPerMinute,
            porDia: rate.countPerDay,
            limitePorMinuto: rate.limitPerMinute,
            limitePorDia: rate.limitPerDay,
          },
        },
        { status: 429 },
      )
    }

    // 5. Carrega contexto: categorias compatíveis + few-shot
    const categoriasCompat = await prisma.category.findMany({
      where: {
        companyId,
        isActive: true,
        // Filtra por tipo compatível com a tx (entrada ou saída)
        type:
          tx.type === 'CREDIT'
            ? { in: ['INCOME', 'TRANSFER'] }
            : tx.type === 'DEBIT'
              ? { in: ['EXPENSE', 'TRANSFER'] }
              : undefined,
      },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, dreGroup: true },
    })

    // Few-shot: últimas 10 tx MANUAL+RULE classificadas dessa empresa,
    // ordenadas por updatedAt desc.
    const fewShotRaw = await prisma.transaction.findMany({
      where: {
        bankAccount: { companyId },
        categoryId: { not: null },
        classificationSource: { in: ['MANUAL', 'RULE'] },
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
      select: {
        description: true,
        category: { select: { name: true } },
      },
    })
    const fewShot = fewShotRaw
      .filter((t) => t.category)
      .map((t) => ({
        description: t.description,
        categoryName: t.category!.name,
      }))

    // 6. Chama Claude
    const result = await callClaude({
      tradeName: tx.bankAccount!.company.tradeName ?? tx.bankAccount!.company.name,
      companyType: tx.bankAccount!.company.type,
      categories: categoriasCompat,
      fewShot,
      description: tx.description,
      amount: Math.abs(tx.amount),
      type: tx.type,
      date: tx.date,
      supplierRazaoSocial: tx.supplier?.razaoSocial ?? null,
    })

    if (result.kind === 'disabled') {
      return NextResponse.json(
        { erro: 'IA Contadora desabilitada', detalhe: result.reason },
        { status: 503 },
      )
    }
    if (result.kind === 'rate-limited') {
      return NextResponse.json(
        { erro: 'Claude API com rate limit. Tente em alguns segundos.' },
        { status: 429 },
      )
    }
    if (result.kind === 'timeout') {
      return NextResponse.json(
        { erro: 'Tempo limite na consulta IA. Tente novamente.' },
        { status: 504 },
      )
    }
    if (result.kind === 'invalid-json') {
      return NextResponse.json(
        { erro: 'IA retornou resposta inválida. Tente novamente.' },
        { status: 502 },
      )
    }
    if (result.kind === 'error') {
      return NextResponse.json(
        { erro: `IA indisponível (${result.status ?? '?'}). Tente em instantes.` },
        { status: 503 },
      )
    }

    // result.kind === 'success'
    const { suggestion, inputTokens, outputTokens, costCents } = result

    // 7. Persiste cache + log
    const cacheKey = computeCacheKey(tx.description)
    await putCachedSuggestion(companyId, tx.description, suggestion)
    await logUsage({
      companyId,
      userId: ctx.user.id,
      transactionId: tx.id,
      claudeApiCalled: true,
      inputTokens,
      outputTokens,
      costCents,
      cacheHit: false,
    })

    return NextResponse.json({
      suggestion,
      fromCache: false,
      cacheKey,
      costCents,
      tokens: { input: inputTokens, output: outputTokens },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
