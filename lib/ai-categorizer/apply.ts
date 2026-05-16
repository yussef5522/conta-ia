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
import { buildRuleIndex, predictCategory, type RuleIndex } from './predict'
import { findSimilarTransactions } from './similar'
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
}

export interface ClassifyResult {
  confirmed: number // 1 = a transação base
  similarApplied: number // N similares pareadas no bulk
  ruleId: string | null // ID da regra criada/usada (null se learnPattern=false)
  ruleCreated: boolean // true se foi criação, false se foi reuso
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
  if (base.bankAccount.companyId !== ctx.company.id) {
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

  // 3. Se learnPattern=true: prepara regra (build OU reuse)
  let ruleId: string | null = null
  let ruleCreated = false
  let ruleSnapshot: RuleSnapshot | null = null

  if (input.learnPattern) {
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
          classifiedByRuleId: ruleSnapshot.id,
          aiConfidence: ruleSnapshot.confianca,
        },
      })

      // Atualiza estatística da regra
      await tx.aiLearningRule.update({
        where: { id: ruleSnapshot.id },
        data: { vezesAplicada: { increment: similarTxIds.length } },
      })
    }
  })

  // 6. Audit log (fora da $transaction pra simplificar; já temos consistency
  // do update da regra com a aplicação via vezesAplicada incrementado dentro)
  await logAudit(
    ctx,
    {
      action: 'UPDATE',
      entityType: 'Transaction',
      entityId: input.transactionId,
      metadata: {
        source: input.applyToSimilar ? 'AI_LEARNED_BULK' : 'MANUAL',
        categoryId: input.categoryId,
        ruleId,
        ruleCreated,
        similarApplied,
        similarTxIds: similarTxIds.slice(0, 50), // sample pra não inchar
      },
      request,
    },
  )

  return {
    confirmed: 1,
    similarApplied,
    ruleId,
    ruleCreated,
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
  aiConfidence?: number | null
}

export interface AutoClassifyResult {
  classified: AutoClassifyOutputTx[]
  // IDs das regras que dispararam → caller incrementa vezesAplicada delas
  rulesFired: Map<string, number> // ruleId → count
  autoCount: number
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
): AutoClassifyResult {
  const classified: AutoClassifyOutputTx[] = []
  const rulesFired = new Map<string, number>()
  let autoCount = 0

  for (const tx of txs) {
    const prediction = predictCategory({ description: tx.description }, index)
    if (prediction && prediction.confidence >= 0.95) {
      classified.push({
        ...tx,
        status: 'RECONCILED',
        categoryId: prediction.categoryId,
        classificationSource: 'RULE',
        classifiedByRuleId: prediction.ruleId,
        aiConfidence: prediction.confidence,
      })
      rulesFired.set(
        prediction.ruleId,
        (rulesFired.get(prediction.ruleId) ?? 0) + 1,
      )
      autoCount += 1
    } else {
      classified.push({ ...tx, status: 'PENDING' })
    }
  }

  return { classified, rulesFired, autoCount }
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
