// Sprint 5.0.2.n — Orquestrador de Vendor Discovery em 3 camadas.
//
// CAMADA 1: Cache global (~5ms, grátis)
// CAMADA 2: BrasilAPI por CNPJ (~500ms, grátis)
// CAMADA 3: Claude Haiku (~2s, ~$0.001)
//
// SEMPRE persiste no cache global quando BrasilAPI ou Claude respondem com
// confidence aceitável → próximas consultas viram cache hit.
//
// Caller: endpoints /api/empresas/[id]/vendor-discovery/*.

import { extractAnchorWord } from '@/lib/categorization/extract-anchor-word'
import { extractCNPJ } from '@/lib/ai-categorizer/cnpj-extractor'
import { fetchCNPJ } from '@/lib/ai-categorizer/brasilapi-client'
import { lookupCacheGlobal, persistDiscovery, incrementCacheHit } from './cache-global'
import { inferirCategoriaContabilFromCNAE } from './cnae-to-category'
import { askClaudeAboutVendor } from './claude-vendor'

export type DiscoverySource =
  | 'CACHE_GLOBAL'
  | 'BRASIL_API'
  | 'CLAUDE_AI'
  | 'NONE'

export interface VendorDiscoveryResult {
  found: boolean
  source: DiscoverySource
  vendorName?: string
  cnpj?: string | null
  razaoSocial?: string | null
  nomeFantasia?: string | null
  cnaePrincipal?: string | null
  cnaeDescricao?: string | null
  categoriaSugerida?: string
  tipoTransacao?: 'INCOME' | 'EXPENSE' | 'ANY'
  confidence: number
  description?: string
  cacheId?: string
  responseTimeMs: number
  custoApi?: number
}

export interface DiscoverInput {
  description: string | null | undefined
  type: 'CREDIT' | 'DEBIT' | string
  /** Permite caller forçar pular Claude (modo grátis-only). Default: false. */
  skipClaude?: boolean
}

const MIN_CACHE_CONFIDENCE = 0.7

/**
 * Roda as 3 camadas em sequência. Primeira que casa com confidence ≥ threshold
 * vence. Caller usa `result.found && result.confidence >= 0.70` como gate.
 */
export async function discoverVendor(
  input: DiscoverInput,
): Promise<VendorDiscoveryResult> {
  const startTime = Date.now()

  if (!input.description) {
    return { found: false, source: 'NONE', confidence: 0, responseTimeMs: 0 }
  }

  const anchor = extractAnchorWord(input.description)
  const cnpj = extractCNPJ(input.description)
  const tipoTransacao: 'INCOME' | 'EXPENSE' =
    input.type === 'CREDIT' ? 'INCOME' : 'EXPENSE'

  if (!anchor && !cnpj) {
    return {
      found: false,
      source: 'NONE',
      confidence: 0,
      responseTimeMs: Date.now() - startTime,
    }
  }

  // ─────────────────────────────────────────────────────────
  // CAMADA 1: Cache Global
  // ─────────────────────────────────────────────────────────
  const cacheHit = await lookupCacheGlobal({ cnpj, vendorName: anchor })
  if (cacheHit) {
    await incrementCacheHit(cacheHit.id)
    return {
      found: true,
      source: 'CACHE_GLOBAL',
      vendorName: cacheHit.vendorName,
      cnpj: cacheHit.cnpj,
      razaoSocial: cacheHit.razaoSocial,
      nomeFantasia: cacheHit.nomeFantasia,
      cnaePrincipal: cacheHit.cnaePrincipal,
      cnaeDescricao: cacheHit.cnaeDescricao,
      categoriaSugerida: cacheHit.categoriaSugerida,
      tipoTransacao: cacheHit.tipoTransacao as 'INCOME' | 'EXPENSE' | 'ANY',
      confidence: cacheHit.scoreAtual,
      description:
        cacheHit.razaoSocial && cacheHit.cnaeDescricao
          ? `${cacheHit.razaoSocial} · ${cacheHit.cnaeDescricao}`
          : `Vendor conhecido: ${cacheHit.vendorName}`,
      cacheId: cacheHit.id,
      responseTimeMs: Date.now() - startTime,
      custoApi: 0,
    }
  }

  // ─────────────────────────────────────────────────────────
  // CAMADA 2: BrasilAPI (somente se temos CNPJ)
  // ─────────────────────────────────────────────────────────
  if (cnpj) {
    const apiResult = await fetchCNPJ(cnpj)
    if (apiResult.kind === 'success') {
      const data = apiResult.data
      const categoria = inferirCategoriaContabilFromCNAE(
        data.cnae_fiscal,
        input.type === 'CREDIT' ? 'CREDIT' : 'DEBIT',
      )
      const vendorName = data.nome_fantasia || data.razao_social
      const categoriaSugerida = categoria?.categoria ?? 'A Categorizar'
      const baseConfidence = categoria?.confidence ?? 0.5

      const cacheId = await persistDiscovery({
        cnpj: data.cnpj,
        vendorName,
        razaoSocial: data.razao_social,
        nomeFantasia: data.nome_fantasia,
        cnaePrincipal:
          data.cnae_fiscal !== null && data.cnae_fiscal !== undefined
            ? String(data.cnae_fiscal)
            : null,
        cnaeDescricao: data.cnae_fiscal_descricao,
        categoriaSugerida,
        categoriaConfidence: baseConfidence,
        tipoTransacao,
        origem: 'BRASIL_API',
        scoreInicial: Math.max(0.85, baseConfidence),
      })

      return {
        found: true,
        source: 'BRASIL_API',
        vendorName,
        cnpj: data.cnpj,
        razaoSocial: data.razao_social,
        nomeFantasia: data.nome_fantasia,
        cnaePrincipal: data.cnae_fiscal !== null ? String(data.cnae_fiscal) : null,
        cnaeDescricao: data.cnae_fiscal_descricao,
        categoriaSugerida,
        tipoTransacao,
        confidence: Math.max(0.85, baseConfidence),
        description: data.cnae_fiscal_descricao
          ? `${data.razao_social} · ${data.cnae_fiscal_descricao}`
          : data.razao_social,
        cacheId,
        responseTimeMs: Date.now() - startTime,
        custoApi: 0,
      }
    }
    // Erro BrasilAPI (timeout/rate-limited/not-found/error) → cai pra Claude
  }

  // ─────────────────────────────────────────────────────────
  // CAMADA 3: Claude Haiku
  // ─────────────────────────────────────────────────────────
  if (input.skipClaude) {
    return {
      found: false,
      source: 'NONE',
      confidence: 0,
      responseTimeMs: Date.now() - startTime,
    }
  }

  const claudeResult = await askClaudeAboutVendor({
    vendorName: anchor ?? cnpj ?? '',
    cnpj: cnpj ?? null,
    transactionDescription: input.description,
    transactionType: input.type === 'CREDIT' ? 'CREDIT' : 'DEBIT',
  })

  if (claudeResult.confidence >= MIN_CACHE_CONFIDENCE) {
    const cacheId = await persistDiscovery({
      cnpj: cnpj ?? null,
      vendorName: claudeResult.vendorName,
      razaoSocial: claudeResult.razaoSocial,
      nomeFantasia: claudeResult.nomeFantasia,
      categoriaSugerida: claudeResult.categoriaSugerida,
      categoriaConfidence: claudeResult.confidence,
      tipoTransacao,
      origem: 'CLAUDE_AI',
      scoreInicial: claudeResult.confidence,
    })
    return {
      found: true,
      source: 'CLAUDE_AI',
      vendorName: claudeResult.vendorName,
      cnpj: cnpj ?? null,
      razaoSocial: claudeResult.razaoSocial,
      nomeFantasia: claudeResult.nomeFantasia,
      categoriaSugerida: claudeResult.categoriaSugerida,
      tipoTransacao,
      confidence: claudeResult.confidence,
      description: claudeResult.description,
      cacheId,
      responseTimeMs: Date.now() - startTime,
      custoApi: claudeResult.custoApi,
    }
  }

  // Confidence baixa — não persiste, mas reporta pra UI mostrar mensagem.
  return {
    found: false,
    source: 'CLAUDE_AI',
    confidence: claudeResult.confidence,
    responseTimeMs: Date.now() - startTime,
    custoApi: claudeResult.custoApi,
    description: claudeResult.description,
  }
}
