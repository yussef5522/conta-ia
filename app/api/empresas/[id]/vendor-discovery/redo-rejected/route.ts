// Sprint 5.0.2.o — Re-roda discovery em tx que foram REJECTED ou
// cujo último discovery foi LOW_CONFIDENCE/NOT_FOUND.
//
// Útil depois de clean-poisoned-cache: agora que o cache está limpo, retentar
// dispara o NOVO pipeline (com keyword fallback + prompt agressivo).

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { discoverVendor } from '@/lib/vendor-discovery/discover'

interface Params {
  params: Promise<{ id: string }>
}

const BATCH_CAP = 200
const PARALLEL = 5

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.update')

    const t0 = Date.now()

    // Pega tx PENDING sem categoria. Vamos retentar todas — caller já chamou
    // clean-poisoned-cache antes, então cache não vai voltar com lixo.
    const pendentes = await prisma.transaction.findMany({
      where: {
        bankAccount: { companyId },
        categoryId: null,
        status: 'PENDING',
        lifecycle: 'EFFECTED',
        type: { not: 'TRANSFER' },
      },
      select: { id: true, description: true, type: true },
      take: BATCH_CAP,
    })

    let totalCost = 0
    const breakdown = { cache: 0, brasilapi: 0, keyword: 0, claude: 0, none: 0 }
    const suggestions: Array<{
      transactionId: string
      description: string | null
      type: string
      result: Awaited<ReturnType<typeof discoverVendor>>
      logId: string
    }> = []

    for (let i = 0; i < pendentes.length; i += PARALLEL) {
      const slice = pendentes.slice(i, i + PARALLEL)
      const results = await Promise.all(
        slice.map(async (tx) => {
          const result = await discoverVendor({
            description: tx.description,
            type: tx.type,
          })
          const log = await prisma.vendorDiscoveryLog.create({
            data: {
              companyId,
              transactionId: tx.id,
              vendorNameQueried: tx.description?.slice(0, 200) ?? '',
              cnpjQueried: result.cnpj ?? null,
              origem: result.source,
              resultado: result.found
                ? 'FOUND'
                : result.confidence > 0
                  ? 'LOW_CONFIDENCE'
                  : 'NOT_FOUND',
              responseTime: result.responseTimeMs,
              custoApi: result.custoApi ?? null,
              estrategiaUsada: result.estrategiaUsada ?? null,
              matchedKeyword: result.matchedKeyword ?? null,
              claudeRawResponse: result.claudeRawResponse ?? null,
            },
          })
          return { tx, result, logId: log.id }
        }),
      )
      for (const { tx, result, logId } of results) {
        if (result.custoApi) totalCost += result.custoApi
        if (result.source === 'CACHE_GLOBAL') breakdown.cache++
        else if (result.source === 'BRASIL_API') breakdown.brasilapi++
        else if (result.source === 'KEYWORD_MATCH') breakdown.keyword++
        else if (result.source === 'CLAUDE_AI' && result.found) breakdown.claude++
        else breakdown.none++
        if (result.found) {
          suggestions.push({
            transactionId: tx.id,
            description: tx.description,
            type: tx.type,
            result,
            logId,
          })
        }
      }
    }

    const elapsedMs = Date.now() - t0
    console.log(
      `[REDO-REJECTED] company=${companyId} analyzed=${pendentes.length} ` +
        `found=${suggestions.length} cache=${breakdown.cache} ` +
        `brasilapi=${breakdown.brasilapi} keyword=${breakdown.keyword} ` +
        `claude=${breakdown.claude} cost=$${totalCost.toFixed(4)} elapsed=${elapsedMs}ms`,
    )

    return NextResponse.json({
      total: pendentes.length,
      found: suggestions.length,
      breakdown,
      totalCostUsd: totalCost,
      elapsedMs,
      suggestions,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
