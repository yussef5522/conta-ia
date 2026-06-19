// Sprint Import Categoria Editável (18/06/2026) — apply category overrides
// no momento do confirm + criar AiLearningRules em massa.
//
// Função PURA pra apply. Função DB pra createRules (atomic).

import type { PrismaClient } from '@prisma/client'

/** Override por dedupHash (vindo da UI quando o user editou a categoria) */
export interface CategoryOverride {
  dedupHash: string
  categoryId: string | null // null = mantém "A classificar"
}

/** Regra a criar/upsert (vinda da UI quando o user marcou "criar regra") */
export interface NewRuleSpec {
  tipoMatch: 'EXACT' | 'CONTAINS' | 'CNPJ'
  padrao: string
  categoryId: string
}

export interface ApplyOverridesInput {
  /** tx pré-classificadas pelo pipeline IA (de autoClassifyTransactions) */
  classifiedTxs: Array<{
    dedupHash: string | null
    categoryId: string | null
    classificationSource: string | null
    aiConfidence: number | null
    classifiedByRuleId: string | null
    status: string
    [k: string]: unknown
  }>
  overrides: CategoryOverride[]
}

/**
 * Sobrescreve categoryId/source/status com base nos overrides da UI.
 * Preserva qualquer outro campo. Função PURA — retorna novo array.
 *
 * Tipado como `any[]` por dentro pra preservar shape complexo do
 * autoClassifyTransactions sem refletir todos os campos aqui.
 */
export function applyCategoryOverrides<T extends { dedupHash: string | null }>(
  classifiedTxs: T[],
  overrides: CategoryOverride[],
): T[] {
  const overrideMap = new Map<string, string | null>()
  for (const o of overrides) {
    overrideMap.set(o.dedupHash, o.categoryId)
  }
  return classifiedTxs.map((t) => {
    if (!t.dedupHash) return t
    if (!overrideMap.has(t.dedupHash)) return t
    const newCatId = overrideMap.get(t.dedupHash) ?? null
    // Override pelo usuário => MANUAL, confiança = 1.0, status RECONCILED se tem categoria
    return {
      ...t,
      categoryId: newCatId,
      classificationSource: 'MANUAL',
      classifiedByRuleId: null,
      aiConfidence: newCatId ? 1.0 : null,
      status: newCatId ? 'RECONCILED' : 'PENDING',
    }
  })
}

/**
 * Cria AiLearningRules em batch. Upsert por @@unique([companyId, tipoMatch, padrao]).
 * Pula regras inválidas (categoria não pertence à empresa, padrão vazio).
 */
export async function persistNewRules(
  prisma: PrismaClient,
  companyId: string,
  rules: NewRuleSpec[],
): Promise<{ created: number; updated: number; skipped: number }> {
  let created = 0
  let updated = 0
  let skipped = 0

  // Pré-valida categorias da empresa
  const catIds = Array.from(new Set(rules.map((r) => r.categoryId).filter(Boolean)))
  const validCats = await prisma.category.findMany({
    where: { id: { in: catIds }, companyId, isActive: true },
    select: { id: true },
  })
  const validCatSet = new Set(validCats.map((c) => c.id))

  for (const r of rules) {
    const padrao = r.padrao.trim()
    if (!padrao || !validCatSet.has(r.categoryId)) {
      skipped++
      continue
    }
    try {
      const existing = await prisma.aiLearningRule.findFirst({
        where: { companyId, tipoMatch: r.tipoMatch, padrao },
        select: { id: true },
      })
      if (existing) {
        await prisma.aiLearningRule.update({
          where: { id: existing.id },
          data: {
            categoryId: r.categoryId,
            isActive: true,
            fonte: 'MANUAL',
            confianca: 1.0,
          },
        })
        updated++
      } else {
        await prisma.aiLearningRule.create({
          data: {
            companyId,
            tipoMatch: r.tipoMatch,
            padrao,
            categoryId: r.categoryId,
            confianca: 1.0,
            fonte: 'MANUAL',
            isActive: true,
            vezesAplicada: 0,
          },
        })
        created++
      }
    } catch {
      skipped++
    }
  }

  return { created, updated, skipped }
}
