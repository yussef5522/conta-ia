// Orquestrador atomic do Engine de Aprendizado — Fase 3 Etapa 1.
//
// Diferente das libs vizinhas (normalize/learn/predict/similar = PURAS),
// este arquivo TEM acesso a Prisma + Audit Log + RBAC.
//
// 3 fluxos principais:
//   1. classifyWithLearning(txId, categoryId, learnPattern, applyToSimilar)
//      → endpoint "✓ Aplicar e Aprender" no card de pendentes
//   2. autoClassifyOnImport(companyId, novasTransacoes)
//      → chamado dentro do importar-ofx, antes do createMany
//   3. recordOverride(txId, novaCategoryId)
//      → quando user MUDA classificação aplicada por regra → cai confiança

import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import type { AuthContext } from '@/lib/auth/rbac'
import { buildNewRule, updateRuleOnOverride } from './learn'
import { extractDescriptionStem } from '@/lib/rules/extract-stem'
import { buildRuleIndex, predictCategory, type RuleIndex } from './predict'
import { findSimilarTransactions } from './similar'
import { classifyForImport } from './pipeline'
import { resolveCategoryFromHint } from './pipeline'
import { invalidateCachedSuggestion } from './claude-cache'
import type {
  Prediction,
  RuleSnapshot,
  TipoMatch,
  TxSnapshot,
} from './types'

// ============================================================
// 1. Fluxo do user: classificar + aprender + aplicar em similares
// ============================================================

export interface ClassifyWithLearningInput {
  transactionId: string
  categoryId: string
  // Se true: cria/atualiza regra a partir desta confirmação (toggle "Aprender")
  learnPattern: boolean
  // Se true E learnPattern=true: aplica regra em TODAS as outras pendentes
  // que casam o padrão (modal "276 similares" com botão "Aplicar todas")
  applyToSimilar: boolean
  // Fase 3 Etapa 3 — contexto de sugestão Claude (Camada 3):
  //   - claudeCacheKey: chave do AiClaudeCache que originou a sugestão
  //   - claudeSuggestedCategoryId: categoria que Claude havia sugerido
  // Quando categoryId final !== claudeSuggestedCategoryId, invalida cache
  // e NÃO cria regra (sugestão errada não vira aprendizado).
  claudeCacheKey?: string
  claudeSuggestedCategoryId?: string | null
}

export interface ClassifyResult {
  confirmed: number // 1 = a transação base
  similarApplied: number // N similares pareadas no bulk
  ruleId: string | null // ID da regra criada/usada (null se learnPattern=false)
  ruleCreated: boolean // true se foi criação, false se foi reuso
  // Quando user overrideu sugestão Claude
  claudeCacheInvalidated: boolean
}

export async function classifyWithLearning(
  input: ClassifyWithLearningInput,
  ctx: AuthContext,
  request?: NextRequest,
): Promise<ClassifyResult> {
  if (!ctx.company) {
    throw new Error('Contexto de empresa requerido')
  }

  // 1. Busca a transação base + valida ownership
  const base = await prisma.transaction.findUnique({
    where: { id: input.transactionId },
    include: {
      bankAccount: { select: { companyId: true } },
    },
  })
  if (!base) throw new Error('Transação não encontrada')
  if (base.bankAccount!.companyId !== ctx.company.id) {
    throw new Error('Transação não pertence à empresa do contexto')
  }

  // 2. Valida categoria (mesma empresa)
  const category = await prisma.category.findUnique({
    where: { id: input.categoryId },
    select: { id: true, companyId: true },
  })
  if (!category || category.companyId !== ctx.company.id) {
    throw new Error('Categoria inválida pra esta empresa')
  }

  // Fase 3 Etapa 3: detecta OVERRIDE de sugestão Claude.
  // Se user MUDOU a categoria sugerida pelo Claude:
  //   - NÃO cria regra Camada 1 (sugestão errada não vira aprendizado)
  //   - INVALIDA cache (próximo classifyAsync vai re-perguntar Claude)
  //   - learnPattern é forçado false
  const claudeOverridden =
    input.claudeSuggestedCategoryId !== undefined &&
    input.claudeSuggestedCategoryId !== null &&
    input.claudeSuggestedCategoryId !== input.categoryId
  const effectiveLearnPattern = claudeOverridden ? false : input.learnPattern

  let claudeCacheInvalidated = false
  if (claudeOverridden && input.claudeCacheKey) {
    claudeCacheInvalidated = await invalidateCachedSuggestion(
      ctx.company.id,
      input.claudeCacheKey,
    )
  }

  // 3. Se effectiveLearnPattern=true: prepara regra (build OU reuse)
  let ruleId: string | null = null
  let ruleCreated = false
  let ruleSnapshot: RuleSnapshot | null = null

  if (effectiveLearnPattern) {
    const newRuleData = buildNewRule(
      ctx.company.id,
      base.description,
      input.categoryId,
    )

    // upsert via unique [companyId, tipoMatch, padrao]
    const upserted = await prisma.aiLearningRule.upsert({
      where: {
        companyId_tipoMatch_padrao: {
          companyId: newRuleData.companyId,
          tipoMatch: newRuleData.tipoMatch,
          padrao: newRuleData.padrao,
        },
      },
      create: {
        companyId: newRuleData.companyId,
        tipoMatch: newRuleData.tipoMatch,
        padrao: newRuleData.padrao,
        categoryId: newRuleData.categoryId,
        confianca: newRuleData.confianca,
        fonte: newRuleData.fonte,
      },
      update: {
        // Se já existe e estava inativa, reativa (user re-aprendeu)
        isActive: true,
        // Garante categoria atual (caso user "reaprenda" com outra)
        categoryId: newRuleData.categoryId,
        // Se manual reconfirma, sobe confiança gentilmente
        confianca: { increment: 0.02 },
      },
    })
    ruleId = upserted.id
    ruleCreated = upserted.createdAt.getTime() === upserted.updatedAt.getTime()
    ruleSnapshot = toRuleSnapshot(upserted)
  }

  // 4. Se applyToSimilar=true E temos regra: busca pendentes similares
  let similarApplied = 0
  let similarTxIds: string[] = []
  let stemRule: { id: string; padrao: string } | null = null
  if (input.applyToSimilar && ruleSnapshot) {
    const candidatas = await fetchPendingCandidates(
      ctx.company.id,
      input.transactionId,
    )
    const similares = findSimilarTransactions(
      {
        baseDescription: base.description,
        tipoMatch: ruleSnapshot.tipoMatch,
        candidatas,
      },
      input.transactionId,
    )
    similarTxIds = similares.map((s) => s.id)
    similarApplied = similarTxIds.length

    // Sprint 5.0.2.k — STEM FALLBACK: se EXACT/NORMALIZED não pegou nada
    // (caso típico: "RECEBIMENTO PIX-PIX_CRED 12345... João Vitor"), tenta
    // substring do stem (remove CPF/CNPJ/IDs/nomes). Cria regra CONTAINS
    // separada pra próximos imports.
    if (similarTxIds.length === 0) {
      const stem = extractDescriptionStem(base.description)
      if (stem && stem.length >= 4) {
        const stemUpper = stem.toUpperCase()
        const stemMatches = candidatas
          .filter((c) => c.id !== input.transactionId)
          .filter((c) => c.categoryId === null)
          .filter((c) => c.type === base.type)
          .filter((c) => (c.description ?? '').toUpperCase().includes(stemUpper))
        if (stemMatches.length >= 2) {
          similarTxIds = stemMatches.map((s) => s.id)
          similarApplied = similarTxIds.length

          // Cria/upsert regra CONTAINS com padrao = stem
          const containsRule = await prisma.aiLearningRule.upsert({
            where: {
              companyId_tipoMatch_padrao: {
                companyId: ctx.company.id,
                tipoMatch: 'CONTAINS',
                padrao: stem,
              },
            },
            create: {
              companyId: ctx.company.id,
              tipoMatch: 'CONTAINS',
              padrao: stem,
              categoryId: input.categoryId,
              confianca: 1.0,
              fonte: 'MANUAL',
              isActive: true,
            },
            update: {
              isActive: true,
              categoryId: input.categoryId,
              confianca: 1.0,
            },
          })
          stemRule = { id: containsRule.id, padrao: stem }
        }
      }
    }
  }

  // 5. ATOMIC: update transaction base + update similares + audit log
  await prisma.$transaction(async (tx) => {
    // Update base
    await tx.transaction.update({
      where: { id: input.transactionId },
      data: {
        categoryId: input.categoryId,
        status: 'RECONCILED',
        classificationSource: 'MANUAL',
        aiConfidence: null,
        classifiedByRuleId: null,
      },
    })

    // Update similares
    if (similarTxIds.length > 0 && ruleSnapshot) {
      // Sprint 5.0.2.k — stemRule pode ter sido criada (substring CONTAINS);
      // se sim, é ela que atribuiu as similares.
      const effectiveRuleId = stemRule ? stemRule.id : ruleSnapshot.id
      const effectiveConfianca = stemRule ? 1.0 : ruleSnapshot.confianca

      await tx.transaction.updateMany({
        where: {
          id: { in: similarTxIds },
          // Defesa em profundidade: garantia multi-tenant
          bankAccount: { companyId: ctx.company!.id },
          categoryId: null,
          status: 'PENDING',
        },
        data: {
          categoryId: input.categoryId,
          status: 'RECONCILED',
          classificationSource: 'RULE',
          classifiedByRuleId: effectiveRuleId,
          aiConfidence: effectiveConfianca,
        },
      })

      await tx.aiLearningRule.update({
        where: { id: effectiveRuleId },
        data: { vezesAplicada: { increment: similarTxIds.length } },
      })
    }
  })

  // 6. Audit log (fora da $transaction pra simplificar; já temos consistency
  // do update da regra com a aplicação via vezesAplicada incrementado dentro)
  const auditSource = claudeOverridden
    ? 'CLAUDE_OVERRIDDEN'
    : input.claudeSuggestedCategoryId === input.categoryId
      ? 'CLAUDE_CONFIRMED'
      : input.applyToSimilar
        ? 'AI_LEARNED_BULK'
        : 'MANUAL'

  await logAudit(
    ctx,
    {
      action: 'UPDATE',
      entityType: 'Transaction',
      entityId: input.transactionId,
      metadata: {
        source: auditSource,
        categoryId: input.categoryId,
        ruleId,
        ruleCreated,
        similarApplied,
        similarTxIds: similarTxIds.slice(0, 50), // sample pra não inchar
        // Contexto Claude (quando aplicável)
        claudeSuggestedCategoryId: input.claudeSuggestedCategoryId ?? null,
        claudeCacheInvalidated,
      },
      request,
    },
  )

  return {
    confirmed: 1,
    similarApplied,
    ruleId,
    ruleCreated,
    claudeCacheInvalidated,
  }
}

// ============================================================
// 2. Auto-classify durante import OFX
// ============================================================

// Aplica regras EXACT (≥0.95) automaticamente nas transações novas ANTES
// do createMany. Retorna 2 arrays: (a) txs que continuam PENDING normal,
// (b) txs que serão criadas como RECONCILED via regra.
//
// Multi-tenant: caller passa companyId. Função busca SÓ regras dessa empresa.
//
// Performance: 1 query pra todas as regras ativas + Map index O(1).

export interface AutoClassifyInputTx {
  bankAccountId: string
  date: Date
  description: string
  amount: number
  type: string
  externalId: string | null
  dedupHash: string | null
  origin: string
}

export interface AutoClassifyOutputTx extends AutoClassifyInputTx {
  status: 'PENDING' | 'RECONCILED'
  categoryId?: string | null
  classificationSource?: string | null
  classifiedByRuleId?: string | null
  supplierId?: string | null
  aiConfidence?: number | null
}

// Sugestão de fornecedor pendente (Camada 2A) — caller cria Supplier
// + linka transaction.supplierId após o createMany.
export interface SupplierSuggestion {
  // Identificador da tx no array de input (índice + hash) — caller usa pra
  // linkar a tx criada no DB (createMany não retorna IDs, então usamos
  // dedupHash + bankAccountId como chave natural).
  dedupHash: string | null
  bankAccountId: string
  // Dados do Supplier a criar/upsert
  supplierName: string
  cnpj: string | null
  // Sugestão de categoria (resolveCategoryFromHint no caller)
  categoryNameHint: string
  dreGroup: string
  // Confiança da sugestão (KEYWORD = 0.8)
  confidence: number
  // Fonte: "KEYWORD" (Camada 2A) ou "BRASILAPI" (Camada 2B, lazy)
  fonte: 'KEYWORD' | 'BRASILAPI'
}

export interface AutoClassifyResult {
  classified: AutoClassifyOutputTx[]
  // IDs das regras que dispararam → caller incrementa vezesAplicada delas
  rulesFired: Map<string, number> // ruleId → count
  autoCount: number
  // Sugestões de fornecedor que Camada 2A detectou — caller persiste como Supplier
  supplierSuggestions: SupplierSuggestion[]
  keywordHits: number
  // Sprint 5.0.2.l — Camada 2C (UNIVERSAL): hits + count que viraram RECONCILED
  universalHits: number
  universalAutoCount: number
}

// Cache simples por companyId — invalida via clearRulesCache() quando regras
// mudam. Em produção, o import é raro o suficiente que recarregar do DB toda
// vez é OK. Mantemos exportado pra eventual reuse.
export async function loadActiveRules(
  companyId: string,
): Promise<RuleSnapshot[]> {
  const rules = await prisma.aiLearningRule.findMany({
    where: { companyId, isActive: true },
    select: {
      id: true,
      companyId: true,
      tipoMatch: true,
      padrao: true,
      categoryId: true,
      supplierId: true,
      confianca: true,
      vezesAplicada: true,
      isActive: true,
      fonte: true,
    },
  })
  return rules.map(toRuleSnapshot)
}

export function autoClassifyTransactions(
  txs: AutoClassifyInputTx[],
  index: RuleIndex,
  /** Sprint 5.0.2.l — resolver categoryNameHint → categoryId pra Camada UNIVERSAL.
   *  Quando não passado, UNIVERSAL fica desabilitada (modo legado). */
  universalResolver?: (hint: { categoryNameHint: string; dreGroup: string }) => string | null,
): AutoClassifyResult {
  const classified: AutoClassifyOutputTx[] = []
  const rulesFired = new Map<string, number>()
  const supplierSuggestions: SupplierSuggestion[] = []
  let autoCount = 0
  let keywordHits = 0
  let universalHits = 0
  let universalAutoCount = 0

  for (const tx of txs) {
    const pipelineResult = classifyForImport(
      { description: tx.description, type: tx.type },
      index,
    )

    // CAMADA 1 — Regra com confiança AUTO (≥0.95) → aplica direto
    if (
      pipelineResult.layer === 'RULE' &&
      pipelineResult.rulePrediction &&
      pipelineResult.rulePrediction.confidence >= 0.95
    ) {
      const pred = pipelineResult.rulePrediction
      classified.push({
        ...tx,
        status: 'RECONCILED',
        categoryId: pred.categoryId,
        classificationSource: 'RULE',
        classifiedByRuleId: pred.ruleId,
        aiConfidence: pred.confidence,
      })
      rulesFired.set(pred.ruleId, (rulesFired.get(pred.ruleId) ?? 0) + 1)
      autoCount += 1
      continue
    }

    // CAMADA 2A — Keyword detector: marca PENDING mas registra sugestão
    // de fornecedor. Caller cria Supplier + linka transaction.supplierId.
    if (pipelineResult.layer === 'KEYWORD' && pipelineResult.keywordMatch) {
      const kw = pipelineResult.keywordMatch
      classified.push({ ...tx, status: 'PENDING' })
      supplierSuggestions.push({
        dedupHash: tx.dedupHash,
        bankAccountId: tx.bankAccountId,
        supplierName: kw.displayName,
        cnpj: null,
        categoryNameHint: kw.categoryNameHint,
        dreGroup: kw.dreGroup,
        confidence: kw.confidence,
        fonte: 'KEYWORD',
      })
      keywordHits += 1
      continue
    }

    // CAMADA 2C (Sprint 5.0.2.l) — Padrão universal BR (tier AUTO)
    if (
      pipelineResult.layer === 'UNIVERSAL' &&
      pipelineResult.universalMatch &&
      universalResolver
    ) {
      universalHits += 1
      const u = pipelineResult.universalMatch
      const categoryId = universalResolver({
        categoryNameHint: u.pattern.categoryNameHint,
        dreGroup: u.pattern.dreGroup,
      })
      if (categoryId) {
        classified.push({
          ...tx,
          status: 'RECONCILED',
          categoryId,
          classificationSource: 'UNIVERSAL',
          aiConfidence: u.pattern.confidence,
        })
        universalAutoCount += 1
        continue
      }
      // Não resolveu categoria — cai pra PENDING
    }

    // Sem match nas camadas síncronas → PENDING puro
    classified.push({ ...tx, status: 'PENDING' })
  }

  return {
    classified,
    rulesFired,
    autoCount,
    supplierSuggestions,
    keywordHits,
    universalHits,
    universalAutoCount,
  }
}

// ============================================================
// 2B. Persistir sugestões de Supplier (Camada 2A keyword)
// ============================================================
//
// Chamado APÓS o createMany das transações no import. Para cada sugestão:
//   1. Upsert Supplier por (companyId, razaoSocial NORMALIZADA)
//   2. Resolve categoryId via plano de contas (resolveCategoryFromHint)
//   3. updateMany das transactions ligadas (mesmo bankAccountId+dedupHash)
//      → linka transaction.supplierId
//
// IMPORTANTE: NÃO seta status='RECONCILED' nem categoryId na tx — a Camada 2A
// é sugestão, não auto-aplicação. UI mostra badge "Detectado: STONE" e o user
// confirma com 1 click.

export async function persistKeywordSuggestions(
  companyId: string,
  suggestions: SupplierSuggestion[],
  categories: Array<{
    id: string
    name: string
    dreGroup: string | null
    isActive: boolean
  }>,
): Promise<{ suppliersCreated: number; transactionsLinked: number }> {
  if (suggestions.length === 0) {
    return { suppliersCreated: 0, transactionsLinked: 0 }
  }

  // Agrupa sugestões por supplierName (normalizado) — múltiplas tx podem
  // bater na mesma keyword "STONE"
  const byName = new Map<string, SupplierSuggestion[]>()
  for (const s of suggestions) {
    const key = s.supplierName.toLowerCase().trim()
    const list = byName.get(key) ?? []
    list.push(s)
    byName.set(key, list)
  }

  let suppliersCreated = 0
  let transactionsLinked = 0

  for (const [, group] of byName) {
    const sample = group[0]
    const categoryId = resolveCategoryFromHint(categories, {
      dreGroup: sample.dreGroup,
      categoryNameHint: sample.categoryNameHint,
    })

    // Busca supplier existente por (companyId + razaoSocial exata).
    // displayName da keyword é padronizado (sempre o mesmo pra cada entry),
    // então equals literal é suficiente. SQLite (dev) não suporta `mode`.
    const existing = await prisma.supplier.findFirst({
      where: {
        companyId,
        razaoSocial: sample.supplierName,
      },
    })

    let supplierId: string
    if (existing) {
      supplierId = existing.id
      // Atualiza categoryId se ainda não tinha (preserva escolha do user)
      if (!existing.categoryId && categoryId) {
        await prisma.supplier.update({
          where: { id: existing.id },
          data: { categoryId, fonteAtualizadaEm: new Date() },
        })
      }
    } else {
      const created = await prisma.supplier.create({
        data: {
          companyId,
          razaoSocial: sample.supplierName,
          categoryId,
          fonte: 'KEYWORD',
          fonteAtualizadaEm: new Date(),
        },
      })
      supplierId = created.id
      suppliersCreated += 1
    }

    // Linka as transações desta sugestão pelo (bankAccountId, dedupHash)
    const hashes = group
      .map((s) => s.dedupHash)
      .filter((h): h is string => h !== null && h !== '')
    if (hashes.length === 0) continue

    const linked = await prisma.transaction.updateMany({
      where: {
        bankAccount: { companyId },
        bankAccountId: { in: Array.from(new Set(group.map((s) => s.bankAccountId))) },
        dedupHash: { in: hashes },
        supplierId: null, // só linka se ainda não tem
      },
      data: { supplierId, aiConfidence: sample.confidence },
    })
    transactionsLinked += linked.count
  }

  return { suppliersCreated, transactionsLinked }
}

// ============================================================
// 3. Override de classificação RULE → cai confiança
// ============================================================

// Chamado quando user MUDA a categoria de uma transação que foi
// classificada por regra (classificationSource='RULE'). Decrementa
// confiança da regra e desativa se < 0.5.
export async function recordRuleOverride(
  classifiedByRuleId: string,
  ctx: AuthContext,
  request?: NextRequest,
  transactionId?: string,
): Promise<void> {
  const rule = await prisma.aiLearningRule.findUnique({
    where: { id: classifiedByRuleId },
  })
  if (!rule) return // regra removida — silencioso

  // Defesa multi-tenant: só altera regra da empresa atual
  if (ctx.company && rule.companyId !== ctx.company.id) return

  const update = updateRuleOnOverride(toRuleSnapshot(rule))
  await prisma.aiLearningRule.update({
    where: { id: classifiedByRuleId },
    data: {
      confianca: update.confianca,
      isActive: update.isActive,
    },
  })

  if (ctx.company) {
    await logAudit(
      ctx,
      {
        action: 'UPDATE',
        entityType: 'AiLearningRule',
        entityId: classifiedByRuleId,
        metadata: {
          source: 'RULE_OVERRIDDEN',
          oldConfianca: rule.confianca,
          newConfianca: update.confianca,
          deactivated: !update.isActive && rule.isActive,
          transactionId,
        },
        request,
      },
    )
  }
}

// ============================================================
// 4. Helpers
// ============================================================

async function fetchPendingCandidates(
  companyId: string,
  excludeTxId: string,
): Promise<TxSnapshot[]> {
  const candidatas = await prisma.transaction.findMany({
    where: {
      id: { not: excludeTxId },
      categoryId: null,
      status: 'PENDING',
      type: { not: 'TRANSFER' },
      bankAccount: { companyId },
    },
    select: {
      id: true,
      description: true,
      amount: true,
      type: true,
      bankAccountId: true,
      status: true,
      categoryId: true,
    },
    take: 5000, // limite defensivo
  })
  return candidatas
}

interface RuleRowLike {
  id: string
  companyId: string
  tipoMatch: string
  padrao: string
  categoryId: string | null
  supplierId: string | null
  confianca: number
  vezesAplicada: number
  isActive: boolean
  fonte: string
}

function toRuleSnapshot(rule: RuleRowLike): RuleSnapshot {
  return {
    id: rule.id,
    companyId: rule.companyId,
    // Schema usa string; runtime valida que é EXACT|NORMALIZED (Etapa 1)
    tipoMatch: rule.tipoMatch as TipoMatch,
    padrao: rule.padrao,
    categoryId: rule.categoryId,
    supplierId: rule.supplierId,
    confianca: rule.confianca,
    vezesAplicada: rule.vezesAplicada,
    isActive: rule.isActive,
    fonte: rule.fonte,
  }
}

// Re-export pros testes / callers externos
export { buildRuleIndex, predictCategory }
export type { Prediction, RuleIndex, TxSnapshot }
