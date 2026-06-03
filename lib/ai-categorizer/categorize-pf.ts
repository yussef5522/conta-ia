// Sprint PF Fatia 3 — Pipeline categorização PF.
//
// Camadas (na ordem):
//   1. RULE       — AiLearningRule do PERFIL (EXACT/CONTAINS, conf 0.95+)
//   2. KEYWORD    — keyword-pf (Netflix, iFood, etc, conf 0.85)
//   3. SPECIAL_TX — encargos/multa/IOF/rotativo (categoria forçada)
//   4. CLAUDE     — IA com prompt PF (fallback)
//
// FUNÇÃO PURA orquestradora — Prisma fica no caller.

import {
  detectKeywordPf,
  type KeywordPfEntry,
  KEYWORD_PF_CONFIDENCE,
} from './keyword-pf'
import {
  detectSpecialTx,
  type SpecialTxKind,
} from '@/lib/ofx-card/detect-special-tx'
import { detectInstallment } from '@/lib/ofx-card/detect-installment'
import { normalizeExact, normalizeDescription } from './normalize'

export type PfLayer = 'RULE' | 'KEYWORD' | 'SPECIAL_TX' | 'CLAUDE' | 'NONE'

export interface PfCategoryHint {
  /** Nome da PersonalCategory (matcher faz lookup no perfil) */
  categoryHint: string
}

export interface PfRuleSnapshot {
  id: string
  tipoMatch: 'EXACT' | 'CONTAINS' | 'CNPJ'
  padrao: string
  personalCategoryId: string | null
  confianca: number
}

export interface CategorizePfInput {
  description: string
  amount: number
  type: 'CREDIT' | 'DEBIT'
  rules: PfRuleSnapshot[]
  /** Categorias do perfil pra resolver hint → categoryId */
  categoriesByName: Map<string, { id: string; type: 'INCOME' | 'EXPENSE' }>
}

export interface CategorizePfResult {
  layer: PfLayer
  categoryId: string | null
  confidence: number
  reasoning: string
  ruleIdApplied: string | null
  specialKind: SpecialTxKind
  isInternational: boolean
  shouldSkipImport: boolean
  isInstallment: boolean
  installmentNumber?: number
  installmentTotal?: number
  baseDescription?: string
}

/** Resolve hint (nome) → categoryId real no perfil. */
function resolveCategoryHint(
  hint: string,
  byName: Map<string, { id: string; type: 'INCOME' | 'EXPENSE' }>,
  expectedType: 'INCOME' | 'EXPENSE',
): string | null {
  const norm = hint.toLowerCase().trim()
  for (const [name, cat] of byName.entries()) {
    if (cat.type !== expectedType) continue
    if (name.toLowerCase().trim() === norm) return cat.id
  }
  // Match partial — primeiro que tem o hint como substring
  for (const [name, cat] of byName.entries()) {
    if (cat.type !== expectedType) continue
    if (name.toLowerCase().includes(norm) || norm.includes(name.toLowerCase())) {
      return cat.id
    }
  }
  return null
}

export function categorizePf(input: CategorizePfInput): CategorizePfResult {
  const expectedType: 'INCOME' | 'EXPENSE' =
    input.type === 'CREDIT' ? 'INCOME' : 'EXPENSE'

  // === STEP 0: detect installment (sempre roda — não muda categoria) ===
  const inst = detectInstallment(input.description)

  // === STEP 1: SPECIAL TX (encargos/pagamento) — vem ANTES do CLAUDE ===
  const special = detectSpecialTx(input.description, input.type)
  if (special.kind !== null) {
    let categoryId: string | null = null
    if (special.suggestedCategoryHint) {
      categoryId = resolveCategoryHint(
        special.suggestedCategoryHint,
        input.categoriesByName,
        expectedType,
      )
    }
    return {
      layer: 'SPECIAL_TX',
      categoryId,
      confidence: 0.95,
      reasoning: special.warnMessage ?? `Tipo especial: ${special.kind}`,
      ruleIdApplied: null,
      specialKind: special.kind,
      isInternational: special.isInternational,
      shouldSkipImport: special.shouldSkipImport,
      isInstallment: inst.isInstallment,
      installmentNumber: inst.installmentNumber,
      installmentTotal: inst.installmentTotal,
      baseDescription: inst.baseDescription,
    }
  }

  // Pra categorizar avulsamente, usa baseDescription se parcela
  const descToMatch = inst.baseDescription ?? input.description

  // === STEP 2: RULE (regras aprendidas) ===
  const normExact = normalizeExact(descToMatch)
  const normContains = normalizeDescription(descToMatch).toLowerCase()
  for (const r of input.rules) {
    if (!r.personalCategoryId) continue
    if (r.tipoMatch === 'EXACT' && normalizeExact(r.padrao) === normExact) {
      return {
        layer: 'RULE',
        categoryId: r.personalCategoryId,
        confidence: r.confianca,
        reasoning: `Regra EXACT: "${r.padrao}"`,
        ruleIdApplied: r.id,
        specialKind: null,
        isInternational: special.isInternational,
        shouldSkipImport: false,
        isInstallment: inst.isInstallment,
        installmentNumber: inst.installmentNumber,
        installmentTotal: inst.installmentTotal,
        baseDescription: inst.baseDescription,
      }
    }
    if (
      r.tipoMatch === 'CONTAINS' &&
      normContains.includes(normalizeDescription(r.padrao).toLowerCase())
    ) {
      return {
        layer: 'RULE',
        categoryId: r.personalCategoryId,
        confidence: r.confianca * 0.9, // ligeiramente menor que EXACT
        reasoning: `Regra CONTAINS: "${r.padrao}"`,
        ruleIdApplied: r.id,
        specialKind: null,
        isInternational: special.isInternational,
        shouldSkipImport: false,
        isInstallment: inst.isInstallment,
        installmentNumber: inst.installmentNumber,
        installmentTotal: inst.installmentTotal,
        baseDescription: inst.baseDescription,
      }
    }
  }

  // === STEP 3: KEYWORD PF ===
  const kw = detectKeywordPf(descToMatch)
  if (kw.matched && kw.entry) {
    const catId = resolveCategoryHint(
      kw.entry.personalCategoryHint,
      input.categoriesByName,
      expectedType,
    )
    if (catId) {
      return {
        layer: 'KEYWORD',
        categoryId: catId,
        confidence: KEYWORD_PF_CONFIDENCE,
        reasoning: `Detectado: ${kw.entry.displayName}`,
        ruleIdApplied: null,
        specialKind: null,
        isInternational: special.isInternational,
        shouldSkipImport: false,
        isInstallment: inst.isInstallment,
        installmentNumber: inst.installmentNumber,
        installmentTotal: inst.installmentTotal,
        baseDescription: inst.baseDescription,
      }
    }
  }

  // === STEP 4: CLAUDE (fallback) ===
  // O CLAUDE call é feito pelo caller (precisa fetch). Aqui só retorna "PENDING".
  return {
    layer: 'NONE',
    categoryId: null,
    confidence: 0,
    reasoning: 'Aguarda IA Claude (pipeline pure exit)',
    ruleIdApplied: null,
    specialKind: null,
    isInternational: special.isInternational,
    shouldSkipImport: false,
    isInstallment: inst.isInstallment,
    installmentNumber: inst.installmentNumber,
    installmentTotal: inst.installmentTotal,
    baseDescription: inst.baseDescription,
  }
}
