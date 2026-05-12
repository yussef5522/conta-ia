// Top 5 Categorias de DESPESA — Sprint 1 Dia 2.
// Função PURA: recebe groupBy do Prisma + categorias da empresa, retorna top 5
// de despesa com cores fixas da paleta DASHBOARD-PLAN B.5.

export interface CategoryGroup {
  categoryId: string
  totalAmount: number
}

export interface CategoryMeta {
  id: string
  name: string
  dreGroup: string | null
}

// Cores fixas da paleta DASHBOARD-PLAN B.5 — consistência visual prioritária.
// Sempre 5 cores na mesma ordem (1º = brand, 2º = success, ...).
export const TOP_CATEGORY_COLORS = [
  '#185FA5', // brand (1º)
  '#1D9E75', // success (2º)
  '#EF9F27', // warning (3º)
  '#E24B4A', // danger (4º)
  '#6B7280', // gray (5º)
] as const

export interface TopCategoryItem {
  categoryId: string
  name: string
  amount: number
  // Percentual relativo ao total das categorias TOP (não ao total geral)
  percent: number
  color: string
}

export interface TopCategoriesResult {
  items: TopCategoryItem[]
  totalDespesas: number
  companyId: string
}

// dreGroups considerados despesa (pra DRE). Receitas e grupos não-DRE são excluídos.
const EXPENSE_DRE_GROUPS = new Set([
  'CUSTO_PRODUTO_VENDIDO',
  'DESPESAS_PESSOAL',
  'DESPESAS_COMERCIAIS',
  'DESPESAS_ADMINISTRATIVAS',
  'DESPESAS_FINANCEIRAS',
  'OUTRAS_DESPESAS',
  'IMPOSTOS_SOBRE_LUCRO',
])

export function computeTopCategories(
  groups: CategoryGroup[],
  categoriesById: Map<string, CategoryMeta>,
  companyId: string,
  limit = 5,
): TopCategoriesResult {
  if (!companyId) {
    throw new Error('companyId é obrigatório (isolamento multi-tenant)')
  }

  // 1. Enriquece com metadata + filtra só DESPESAS
  type Enriched = { categoryId: string; name: string; amount: number }
  const onlyExpenses: Enriched[] = []
  for (const g of groups) {
    const cat = categoriesById.get(g.categoryId)
    if (!cat) continue
    if (!cat.dreGroup) continue
    if (!EXPENSE_DRE_GROUPS.has(cat.dreGroup)) continue
    onlyExpenses.push({
      categoryId: g.categoryId,
      name: cat.name,
      amount: g.totalAmount,
    })
  }

  // 2. Ordena DESC e corta no limite
  onlyExpenses.sort((a, b) => b.amount - a.amount)
  const top = onlyExpenses.slice(0, limit)

  // 3. Total das top (pra percent relativo)
  const totalDespesas = top.reduce((s, t) => s + t.amount, 0)

  // 4. Atribui cores fixas + calcula percent
  const items: TopCategoryItem[] = top.map((t, idx) => ({
    categoryId: t.categoryId,
    name: t.name,
    amount: t.amount,
    percent: totalDespesas > 0 ? (t.amount / totalDespesas) * 100 : 0,
    color: TOP_CATEGORY_COLORS[idx] ?? TOP_CATEGORY_COLORS[TOP_CATEGORY_COLORS.length - 1],
  }))

  return {
    items,
    totalDespesas,
    companyId,
  }
}
