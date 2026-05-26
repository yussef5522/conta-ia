// Sprint 5.0.2.m — Memorização automática de fornecedor após categorização manual.
//
// Fluxo silencioso (sem modal, sem pergunta):
//   1. extractAnchorWord(tx.description) → ex: "TECOPONTO"
//   2. Upsert AiLearningRule { tipoMatch: CONTAINS, padrao: anchor,
//      categoryId, fonte: 'AUTO_FROM_MANUAL', confianca: 1.0 }
//   3. Aplica retroativamente em TODAS as outras pendentes da empresa cuja
//      descrição contém o anchor (case-insensitive)
//   4. Retorna { anchor, retroactiveCount, ruleId, ruleCreated }
//
// Multi-tenant: caller passa companyId. Função SÓ mexe em tx/regras dessa
// empresa (where filters).

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { extractAnchorWord } from './extract-anchor-word'

/** Fonte da regra criada por esta sprint — diferencia das MANUAL/CLAUDE. */
export const AUTO_FROM_MANUAL_FONTE = 'AUTO_FROM_MANUAL'

export interface AutoMemorizeResult {
  /** null se anchor não foi extraído (descrição genérica) */
  anchor: string | null
  /** Quantas OUTRAS pendentes foram categorizadas retroativamente */
  retroactiveCount: number
  /** ID da regra criada/atualizada (null se anchor=null) */
  ruleId: string | null
  /** true se foi criação, false se foi reuso de regra existente */
  ruleCreated: boolean
}

export interface AutoMemorizeInput {
  companyId: string
  /** ID da tx que o user acabou de categorizar (excluída da aplicação retroativa) */
  baseTransactionId: string
  /** Descrição da tx-base — usada pra extrair anchor */
  baseDescription: string | null | undefined
  /** Categoria escolhida pelo user */
  categoryId: string
  /** CREDIT/DEBIT — só aplica retroativamente em tx do mesmo tipo */
  baseType: string
}

/**
 * Cria/atualiza regra CONTAINS e aplica retroativamente.
 * Idempotente: rodar 2x com mesmo input não cria duplicata.
 *
 * NÃO faz audit log — caller deve fazer.
 * NÃO atualiza a tx-base — caller já fez isso.
 */
export async function autoMemorizeVendor(
  input: AutoMemorizeInput,
): Promise<AutoMemorizeResult> {
  const anchor = extractAnchorWord(input.baseDescription)
  if (!anchor) {
    return { anchor: null, retroactiveCount: 0, ruleId: null, ruleCreated: false }
  }

  // 1. Upsert regra CONTAINS via chave natural (companyId, tipoMatch, padrao)
  let ruleCreated = false
  let rule
  try {
    rule = await prisma.aiLearningRule.upsert({
      where: {
        companyId_tipoMatch_padrao: {
          companyId: input.companyId,
          tipoMatch: 'CONTAINS',
          padrao: anchor,
        },
      },
      create: {
        companyId: input.companyId,
        tipoMatch: 'CONTAINS',
        padrao: anchor,
        categoryId: input.categoryId,
        confianca: 1.0,
        fonte: AUTO_FROM_MANUAL_FONTE,
        isActive: true,
      },
      update: {
        // Reativa se estava inativa (user re-aprendeu)
        isActive: true,
        // Atualiza categoria (user pode ter mudado)
        categoryId: input.categoryId,
        // Sobe confiança gentilmente quando user reconfirma
        confianca: { increment: 0.0 }, // mantém 1.0 (já MANUAL)
      },
    })
    // createdAt === updatedAt ⇒ acabou de criar
    ruleCreated = rule.createdAt.getTime() === rule.updatedAt.getTime()
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      // Race ou outro erro de constraint — falha silenciosa, sem regra
      console.error('[AUTO_MEMORIZE] upsert falhou:', e.code, anchor)
      return { anchor, retroactiveCount: 0, ruleId: null, ruleCreated: false }
    }
    throw e
  }

  // 2. Aplica retroativamente em pendentes (mesma empresa, mesmo tipo,
  //    descrição contém anchor, sem categoria, status PENDING, EFFECTED).
  //    SQLite NÃO suporta mode 'insensitive' — descrições OFX já são UPPERCASE.
  const retroactive = await prisma.transaction.updateMany({
    where: {
      bankAccount: { companyId: input.companyId },
      id: { not: input.baseTransactionId },
      categoryId: null,
      status: 'PENDING',
      lifecycle: 'EFFECTED',
      type: input.baseType,
      description: { contains: anchor },
    },
    data: {
      categoryId: input.categoryId,
      status: 'RECONCILED',
      classificationSource: 'VENDOR_MEMORY',
      classifiedByRuleId: rule.id,
      aiConfidence: 1.0,
    },
  })

  // 3. Incrementa contador de aplicações da regra
  if (retroactive.count > 0) {
    await prisma.aiLearningRule.update({
      where: { id: rule.id },
      data: { vezesAplicada: { increment: retroactive.count } },
    })
  }

  return {
    anchor,
    retroactiveCount: retroactive.count,
    ruleId: rule.id,
    ruleCreated,
  }
}
