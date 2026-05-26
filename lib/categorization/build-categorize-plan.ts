// Sprint 5.0.2.p — Build "plan" de categorização sem aplicar (dry-run).
//
// Reusa o MESMO pipeline 5-fases do /recategorize-all (Sprint l), mas em
// vez de UPDATE direto, retorna um array { transactionId, categoryId,
// categoryName, source, confidence, description, amount, type }.
//
// O endpoint /preview chama este builder e devolve agrupado por categoria.
// O endpoint /apply recebe a seleção do user e faz updateMany.

import { prisma } from '@/lib/db'
import { ensureAllSystemCategories } from '@/lib/categorias/ensure-system-categories'
import { detectAndPlanPixApply } from '@/lib/pix-detection/auto-apply-pix'
import { matchSameCompanyTransfer } from '@/lib/conciliation/match-same-company-transfer'
import {
  loadPatternsForSetor,
  matchAgainstPatterns,
  resolveSetorCategoryId,
} from '@/lib/categorization/match-setor-pattern'
import { loadActiveRules, buildRuleIndex } from '@/lib/ai-categorizer/apply'
import { predictCategory } from '@/lib/ai-categorizer/predict'

export type PlanSource =
  | 'SAME_COMPANY_TRANSFER'
  | 'PIX_DETECTION'
  | 'RULE_EXACT_NORMALIZED'
  | 'RULE_CONTAINS'
  | 'SETOR_PATTERN'

export interface PlanEntry {
  transactionId: string
  description: string
  amount: number
  type: string
  date: Date
  bankAccountId: string | null
  /** Categoria sugerida (ID resolvido no plano de contas) */
  categoryId: string
  categoryName: string
  source: PlanSource
  confidence: number
  /** Quando aplicável (PIX_DETECTION/SAME_COMPANY): tx pareada do outro lado. */
  linkedTransactionId?: string
  /** Quando aplicável (PIX_DETECTION): tipo de relação detectada. */
  relatedPartyType?: string
  relatedPartyId?: string
}

export interface BuildPlanResult {
  setor: string | null
  totalAnalisadas: number
  planEntries: PlanEntry[]
  semSugestao: number
  breakdown: {
    sameCompany: number
    pix: number
    ruleExact: number
    ruleContains: number
    setorPattern: number
  }
  /** Para uso no /apply pra encontrar categoria pelo nome se user editou. */
  categoryNameToId: Record<string, string>
}

const BATCH_CAP = 3000

export async function buildCategorizePlan(
  companyId: string,
): Promise<BuildPlanResult> {
  const empresa = await prisma.company.findUnique({
    where: { id: companyId },
    select: { setor: true },
  })
  const setorEmpresa = empresa?.setor ?? null

  const [socios, empresas, systemCategories, activeRules, setorPatterns] =
    await Promise.all([
      prisma.socioPF.findMany({ where: { companyId } }),
      prisma.empresaRelacionada.findMany({ where: { companyId } }),
      ensureAllSystemCategories(companyId, setorEmpresa),
      loadActiveRules(companyId),
      loadPatternsForSetor(setorEmpresa),
    ])
  const ruleIndex = buildRuleIndex(companyId, activeRules)

  const pendentes = await prisma.transaction.findMany({
    where: {
      bankAccount: { companyId },
      categoryId: null,
      status: 'PENDING',
      lifecycle: 'EFFECTED',
      type: { not: 'TRANSFER' },
    },
    select: {
      id: true,
      description: true,
      type: true,
      amount: true,
      date: true,
      paymentDate: true,
      dedupHash: true,
      bankAccountId: true,
    },
    take: BATCH_CAP,
  })

  const sociosMapped = socios.map((s) => ({
    id: s.id,
    nome: s.nome,
    cpf: s.cpf,
    pixKeys: safeArray(s.pixKeys),
    papel: s.papel,
  }))
  const empresasMapped = empresas.map((e) => ({
    id: e.id,
    nomeFantasia: e.nomeFantasia,
    cnpjRelacionado: e.cnpjRelacionado,
    pixKeys: safeArray(e.pixKeys),
    relacao: e.relacao,
  }))

  // Cast: TipoMatch type só tem EXACT|NORMALIZED|CONTAINS (Sprint m)
  const containsRules = activeRules.filter(
    (r) => (r.tipoMatch as string) === 'CONTAINS' && r.categoryId && r.isActive,
  )

  // Index categorias por id pra resolver nome rapidamente
  const categoryById = new Map<string, string>()
  for (const c of systemCategories.list) categoryById.set(c.id, c.name)

  const planEntries: PlanEntry[] = []
  let semSugestao = 0
  const breakdown = {
    sameCompany: 0,
    pix: 0,
    ruleExact: 0,
    ruleContains: 0,
    setorPattern: 0,
  }

  for (const tx of pendentes) {
    const dateForMatch = tx.paymentDate ?? tx.date

    // FASE 0 — Same-company transfer
    const sameCompany = await matchSameCompanyTransfer({
      transactionId: tx.id,
      bankAccountId: tx.bankAccountId ?? '',
      companyId,
      type: tx.type,
      amount: tx.amount,
      date: dateForMatch,
      description: tx.description,
    })
    if (sameCompany.matched) {
      const categoryId = systemCategories.transferenciaInternaId
      planEntries.push({
        transactionId: tx.id,
        description: tx.description,
        amount: tx.amount,
        type: tx.type,
        date: tx.date,
        bankAccountId: tx.bankAccountId,
        categoryId,
        categoryName: categoryById.get(categoryId) ?? 'Transferência entre Contas',
        source: 'SAME_COMPANY_TRANSFER',
        confidence: 1.0,
        linkedTransactionId: sameCompany.linkedTransactionId ?? undefined,
      })
      breakdown.sameCompany++
      continue
    }

    // FASE 1 — Pix relacionado (sócio/grupo)
    if (
      (sociosMapped.length > 0 || empresasMapped.length > 0) &&
      tx.description &&
      /PIX/i.test(tx.description)
    ) {
      const plan = detectAndPlanPixApply(
        tx,
        sociosMapped,
        empresasMapped,
        systemCategories,
      )
      if (plan.apply && plan.patch) {
        planEntries.push({
          transactionId: tx.id,
          description: tx.description,
          amount: tx.amount,
          type: tx.type,
          date: tx.date,
          bankAccountId: tx.bankAccountId,
          categoryId: plan.patch.categoryId,
          categoryName:
            categoryById.get(plan.patch.categoryId) ??
            (plan.patch.relatedPartyType === 'SOCIO_PF'
              ? 'Distribuição de Lucros'
              : 'Transferência entre Contas (grupo)'),
          source: 'PIX_DETECTION',
          confidence: 1.0,
          relatedPartyType: plan.patch.relatedPartyType,
          relatedPartyId: plan.patch.relatedPartyId,
        })
        breakdown.pix++
        continue
      }
    }

    // FASE 2 — Regras EXACT/NORMALIZED + CONTAINS
    if (tx.description) {
      const pred = predictCategory({ description: tx.description }, ruleIndex)
      if (pred && pred.categoryId && pred.confidence >= 0.95) {
        planEntries.push({
          transactionId: tx.id,
          description: tx.description,
          amount: tx.amount,
          type: tx.type,
          date: tx.date,
          bankAccountId: tx.bankAccountId,
          categoryId: pred.categoryId,
          categoryName: categoryById.get(pred.categoryId) ?? '(categoria removida)',
          source: 'RULE_EXACT_NORMALIZED',
          confidence: pred.confidence,
        })
        breakdown.ruleExact++
        continue
      }

      const descUpper = tx.description.toUpperCase()
      let matchedContains: typeof containsRules[number] | null = null
      for (const r of containsRules) {
        if (descUpper.includes(r.padrao.toUpperCase())) {
          matchedContains = r
          break
        }
      }
      if (matchedContains && matchedContains.categoryId) {
        planEntries.push({
          transactionId: tx.id,
          description: tx.description,
          amount: tx.amount,
          type: tx.type,
          date: tx.date,
          bankAccountId: tx.bankAccountId,
          categoryId: matchedContains.categoryId,
          categoryName:
            categoryById.get(matchedContains.categoryId) ?? '(categoria removida)',
          source: 'RULE_CONTAINS',
          confidence: matchedContains.confianca,
        })
        breakdown.ruleContains++
        continue
      }
    }

    // FASE 3 — SetorPattern
    const setorMatch = matchAgainstPatterns(
      { description: tx.description, type: tx.type },
      setorPatterns,
    )
    if (setorMatch) {
      const categoryId = resolveSetorCategoryId(
        systemCategories.list,
        setorMatch.pattern.categoryName,
      )
      if (categoryId) {
        planEntries.push({
          transactionId: tx.id,
          description: tx.description,
          amount: tx.amount,
          type: tx.type,
          date: tx.date,
          bankAccountId: tx.bankAccountId,
          categoryId,
          categoryName: categoryById.get(categoryId) ?? setorMatch.pattern.categoryName,
          source: 'SETOR_PATTERN',
          confidence: setorMatch.pattern.confidence,
        })
        breakdown.setorPattern++
        continue
      }
    }

    semSugestao++
  }

  // Categoria nome → id pra apply lidar com overrides do user
  const categoryNameToId: Record<string, string> = {}
  for (const c of systemCategories.list) {
    categoryNameToId[c.name.toLowerCase().trim()] = c.id
  }

  return {
    setor: setorEmpresa,
    totalAnalisadas: pendentes.length,
    planEntries,
    semSugestao,
    breakdown,
    categoryNameToId,
  }
}

function safeArray(stored: string): string[] {
  try {
    const r = JSON.parse(stored)
    return Array.isArray(r) ? r.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}
