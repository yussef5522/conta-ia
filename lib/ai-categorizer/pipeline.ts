// Pipeline IA Contadora — Fase 3 Etapa 2.
// FUNÇÃO PURA orquestradora: combina Camadas 1 (regras), 2A (keyword) e
// 2B (BrasilAPI via callback injetável) sem chamar Prisma diretamente.
//
// Caller (apply.ts) decide o que fazer com o resultado (criar Supplier,
// auto-aplicar, etc).
//
// ORDEM:
//   1. Camada 1 — predict via regras (EXACT >0.95 → AUTO; NORMALIZED → sugestão)
//   2. Camada 2A — keyword detector (sugestão local sem API)
//   3. Camada 2B — BrasilAPI lookup (lazy via callback; opcional no import)
//   4. Sem match → resultado vazio
//
// Cada camada retorna independente; pipeline escolhe a primeira que casa.

import { predictCategory, type RuleIndex } from './predict'
import {
  detectKeyword,
  KEYWORD_DETECTION_CONFIDENCE,
  type KeywordMatch,
} from './keyword-detector'
import { extractCNPJ } from './cnpj-extractor'
import {
  mapCNAEtoCategoryHint,
  type CnaeHint,
} from './cnae-mapping'
import { fetchCNPJ, type BrasilApiResult } from './brasilapi-client'
import {
  matchUniversalPattern,
  type MatchUniversalResult,
} from '@/lib/categorization/apply-universal-patterns'
import type { Prediction } from './types'

// ============================================================
// Tipos
// ============================================================

export type Layer = 'RULE' | 'KEYWORD' | 'UNIVERSAL' | 'BRASILAPI' | 'CLAUDE'

// Resultado unificado de uma transação processada pelo pipeline.
// caller usa isso pra decidir: criar Supplier? Aplicar AUTO? Marcar PENDING?
export interface PipelineResult {
  layer: Layer | null

  // Quando Camada 1 (RULE) casa
  rulePrediction?: Prediction

  // Quando Camada 2A (KEYWORD) casa
  keywordMatch?: KeywordMatch & { confidence: number }

  // Quando Camada 2C (UNIVERSAL Sprint 5.0.2.l) casa
  universalMatch?: MatchUniversalResult

  // Quando Camada 2B (BRASILAPI) casa
  brasilApiData?: {
    cnpj: string
    razaoSocial: string
    nomeFantasia: string | null
    cnaeFiscal: string | null
    cnaeDescricao: string | null
    hint: CnaeHint | null // pode ser null se CNAE não mapeado
    confidence: number
  }

  // Quando Camada 3 (CLAUDE) casa — sugestão do Claude API
  claudeData?: {
    categoryId: string | null
    confidence: number
    reasoning: string
    alternativeCategoryIds: string[]
    fromCache: boolean
    cacheKey: string
    costCents: number
  }
}

// Entrada simplificada do pipeline pra cada transação
export interface PipelineInputTx {
  description: string
  /** Sprint 5.0.2.l — necessário pra Camada 2C (UNIVERSAL) filtrar INCOME/EXPENSE. */
  type?: string
}

// ============================================================
// Modo SÍNCRONO (importação OFX)
// Roda Camada 1 + Camada 2A. NÃO chama BrasilAPI (latência).
// ============================================================

export function classifyForImport(
  tx: PipelineInputTx,
  ruleIndex: RuleIndex,
): PipelineResult {
  // CAMADA 1: regras aprendidas
  const prediction = predictCategory(tx, ruleIndex)
  if (prediction) {
    return { layer: 'RULE', rulePrediction: prediction }
  }

  // CAMADA 2A: keyword detector (local, sem API) — cria Supplier suggestion
  const keyword = detectKeyword(tx.description)
  if (keyword) {
    return {
      layer: 'KEYWORD',
      keywordMatch: {
        ...keyword,
        confidence: KEYWORD_DETECTION_CONFIDENCE,
      },
    }
  }

  // CAMADA 2C (Sprint 5.0.2.l): padrões universais BR
  // Só AUTO tier; SUGGEST tier fica pro bulk retroativo
  const universal = matchUniversalPattern({
    description: tx.description,
    type: tx.type,
  })
  if (universal && universal.tier === 'AUTO') {
    return { layer: 'UNIVERSAL', universalMatch: universal }
  }

  // Sem match nas camadas síncronas. BrasilAPI fica pra modo async (lazy).
  return { layer: null }
}

// ============================================================
// Modo ASSÍNCRONO (lazy lookup BrasilAPI por user click)
// Roda Camada 1 + 2A + 2B em sequência.
// ============================================================

export interface ClassifyAsyncOptions {
  // Permite mock do fetchCNPJ pra testes
  fetcher?: typeof fetchCNPJ
}

export const BRASILAPI_CONFIDENCE = 0.85

export async function classifyAsync(
  tx: PipelineInputTx,
  ruleIndex: RuleIndex,
  options: ClassifyAsyncOptions = {},
): Promise<PipelineResult> {
  // Primeiro tenta os síncronos (regra + keyword)
  const syncResult = classifyForImport(tx, ruleIndex)
  if (syncResult.layer) return syncResult

  // CAMADA 2B: BrasilAPI via CNPJ extraído
  const cnpj = extractCNPJ(tx.description)
  if (!cnpj) return { layer: null }

  const fetcher = options.fetcher ?? fetchCNPJ
  const result = await fetcher(cnpj)

  if (result.kind !== 'success') {
    return { layer: null }
  }

  const cnae = result.data.cnae_fiscal
  const hint = mapCNAEtoCategoryHint(cnae)

  return {
    layer: 'BRASILAPI',
    brasilApiData: {
      cnpj,
      razaoSocial: result.data.razao_social,
      nomeFantasia: result.data.nome_fantasia,
      cnaeFiscal: cnae !== null && cnae !== undefined ? String(cnae) : null,
      cnaeDescricao: result.data.cnae_fiscal_descricao,
      hint,
      confidence: BRASILAPI_CONFIDENCE,
    },
  }
}

// ============================================================
// Helper: dado um plano de contas + dreGroup + categoryNameHint,
// resolve o categoryId concreto da empresa.
//
// Estratégia: PRIMEIRO match exato por nome (normalizado), DEPOIS
// fallback por dreGroup. Retorna null se nenhuma categoria casar.
// ============================================================

export interface CategoryRow {
  id: string
  name: string
  dreGroup: string | null
  isActive: boolean
}

export function resolveCategoryFromHint(
  categories: CategoryRow[],
  hint: { dreGroup: string; categoryNameHint: string },
): string | null {
  const normalizedHint = hint.categoryNameHint.toLowerCase().trim()

  // 1. Match por nome (lowercase + trim)
  const byName = categories.find(
    (c) => c.isActive && c.name.toLowerCase().trim() === normalizedHint,
  )
  if (byName) return byName.id

  // 2. Match parcial — categoria contém o hint (ex: "Telefonia Vivo" contém "Telefonia")
  const byPartial = categories.find(
    (c) =>
      c.isActive &&
      c.name.toLowerCase().includes(normalizedHint) &&
      c.dreGroup === hint.dreGroup,
  )
  if (byPartial) return byPartial.id

  // 3. Fallback: primeira categoria ATIVA com o mesmo dreGroup
  const byGroup = categories.find(
    (c) => c.isActive && c.dreGroup === hint.dreGroup,
  )
  if (byGroup) return byGroup.id

  return null
}
