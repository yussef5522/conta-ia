// Sprint Import Categoria Editável (18/06/2026) — loader DB pra PreviewSuggestionContext

import { prisma } from '@/lib/db'
import { buildRuleIndex, loadActiveRules } from '@/lib/ai-categorizer/apply'
import { ensureAllSystemCategories } from '@/lib/categorias/ensure-system-categories'
import { loadPatternsForSetor } from '@/lib/categorization/match-setor-pattern'
import type { PreviewSuggestionContext } from './predict-for-preview'

export async function loadPredictionContext(
  companyId: string,
): Promise<PreviewSuggestionContext> {
  // 1) AiLearningRule da empresa
  const activeRules = await loadActiveRules(companyId)
  const ruleIndex = buildRuleIndex(companyId, activeRules)

  // 2) Setor + system categories + patterns
  const empresa = await prisma.company.findUnique({
    where: { id: companyId },
    select: { setor: true },
  })
  const setorEmpresa = empresa?.setor ?? null
  const systemCats = await ensureAllSystemCategories(companyId, setorEmpresa)
  const setorPatterns = await loadPatternsForSetor(setorEmpresa)

  // 3) Mapa categoryName -> { id, dreGroup } pra resolver SETOR matches
  const setorCategoryByName = new Map<string, { id: string; dreGroup: string | null }>()
  for (const c of systemCats.list) {
    setorCategoryByName.set(c.name, { id: c.id, dreGroup: c.dreGroup })
  }

  // 4) Mapa categoryId -> { name, dreGroup } pra etiquetar no payload
  const allCats = await prisma.category.findMany({
    where: { companyId, isActive: true },
    select: { id: true, name: true, dreGroup: true },
  })
  const categoryById = new Map<string, { name: string; dreGroup: string | null }>()
  for (const c of allCats) {
    categoryById.set(c.id, { name: c.name, dreGroup: c.dreGroup })
  }

  return {
    ruleIndex,
    setorPatterns,
    setorCategoryByName,
    categoryById,
  }
}
