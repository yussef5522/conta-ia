// Sprint Category-Combobox (29/06/2026) — helpers PUROS pro CategoryCombobox.
// Sem acento, sem case, sem regex weird. Testáveis isoladamente.

export interface CategoryLite {
  id: string
  name: string
  color?: string | null
  type?: string | null
  dreGroup?: string | null
}

/** Remove acentos (Unicode NFD) e baixa-caixa. Determinístico. */
export function normalizeText(s: string): string {
  // [̀-ͯ] = bloco "Combining Diacritical Marks" (acentos pós-NFD).
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Filtra categorias por uma query.
 * - Vazio → retorna todas.
 * - Casa se a query normalizada é substring do nome normalizado.
 * - Score: nome que COMEÇA com a query rankeia maior.
 */
export interface ScoredCategory<T extends CategoryLite> {
  cat: T
  score: number
  matchStart: number
  matchEnd: number
}

export function filterCategories<T extends CategoryLite>(
  categorias: T[],
  query: string,
): ScoredCategory<T>[] {
  const q = normalizeText(query)
  if (!q) {
    return categorias.map((cat) => ({
      cat,
      score: 0,
      matchStart: -1,
      matchEnd: -1,
    }))
  }
  const out: ScoredCategory<T>[] = []
  for (const cat of categorias) {
    const normalized = normalizeText(cat.name)
    const idx = normalized.indexOf(q)
    if (idx === -1) continue
    out.push({
      cat,
      score: idx === 0 ? 2 : 1,
      matchStart: idx,
      matchEnd: idx + q.length,
    })
  }
  out.sort(
    (a, b) =>
      b.score - a.score || a.cat.name.localeCompare(b.cat.name, 'pt-BR'),
  )
  return out
}

/**
 * Labels human-readable pros dreGroups (alinhado com convenções da casa).
 * Categorias sem dreGroup ficam no grupo "Outros".
 */
export const DRE_GROUP_LABELS: Record<string, string> = {
  RECEITA_BRUTA: 'Receitas',
  DEDUCOES: 'Deduções de Receita',
  CUSTOS: 'Custos',
  CUSTO_PRODUTO_VENDIDO: 'Custos',
  DESPESAS_OPERACIONAIS: 'Despesas Operacionais',
  DESPESAS_PESSOAL: 'Despesas com Pessoal',
  DESPESAS_ADMINISTRATIVAS: 'Despesas Administrativas',
  DESPESAS_FINANCEIRAS: 'Despesas Financeiras',
  DESPESAS_TRIBUTARIAS: 'Despesas Tributárias',
  OUTRAS_DESPESAS: 'Outras Despesas',
  OUTRAS_RECEITAS: 'Outras Receitas',
  DISTRIBUICAO_LUCROS: 'Distribuição de Lucros',
  IMPOSTOS: 'Impostos',
}

/** Ordem visual dos grupos no combobox. */
export const DRE_GROUP_ORDER = [
  'RECEITA_BRUTA',
  'OUTRAS_RECEITAS',
  'CUSTOS',
  'CUSTO_PRODUTO_VENDIDO',
  'DESPESAS_OPERACIONAIS',
  'DESPESAS_PESSOAL',
  'DESPESAS_ADMINISTRATIVAS',
  'DESPESAS_FINANCEIRAS',
  'DESPESAS_TRIBUTARIAS',
  'IMPOSTOS',
  'DEDUCOES',
  'OUTRAS_DESPESAS',
  'DISTRIBUICAO_LUCROS',
  'OUTROS',
]

export interface CategoryGroup<T extends CategoryLite> {
  key: string
  label: string
  items: ScoredCategory<T>[]
}

/** Agrupa resultados filtrados por dreGroup, na ordem visual. */
export function groupCategories<T extends CategoryLite>(
  scored: ScoredCategory<T>[],
): CategoryGroup<T>[] {
  const buckets = new Map<string, ScoredCategory<T>[]>()
  for (const s of scored) {
    const key = s.cat.dreGroup || 'OUTROS'
    const arr = buckets.get(key) ?? []
    arr.push(s)
    buckets.set(key, arr)
  }
  const groups: CategoryGroup<T>[] = []
  for (const key of DRE_GROUP_ORDER) {
    const items = buckets.get(key)
    if (items && items.length > 0) {
      groups.push({
        key,
        label: DRE_GROUP_LABELS[key] ?? 'Outros',
        items,
      })
      buckets.delete(key)
    }
  }
  // Grupos não-mapeados (preserva busca completa)
  for (const [key, items] of buckets) {
    groups.push({ key, label: DRE_GROUP_LABELS[key] ?? key, items })
  }
  return groups
}

/** Cor visual por dreGroup (paleta semântica Conta IA). */
export const DRE_GROUP_COLORS: Record<string, string> = {
  RECEITA_BRUTA: '#10b981', // emerald-500
  OUTRAS_RECEITAS: '#34d399', // emerald-400
  CUSTOS: '#f59e0b', // amber-500
  CUSTO_PRODUTO_VENDIDO: '#f59e0b',
  DESPESAS_OPERACIONAIS: '#ef4444', // red-500
  DESPESAS_PESSOAL: '#dc2626', // red-600
  DESPESAS_ADMINISTRATIVAS: '#e11d48', // rose-600
  DESPESAS_FINANCEIRAS: '#9333ea', // purple-600
  DESPESAS_TRIBUTARIAS: '#8b5cf6', // violet-500
  OUTRAS_DESPESAS: '#94a3b8', // slate-400
  OUTRAS_RECEITAS_2: '#34d399',
  DISTRIBUICAO_LUCROS: '#0ea5e9', // sky-500
  IMPOSTOS: '#a78bfa', // violet-400
  DEDUCOES: '#fb7185', // rose-400
  OUTROS: '#64748b',
}

export function groupColor(dreGroup: string | null | undefined): string {
  if (!dreGroup) return DRE_GROUP_COLORS.OUTROS
  return DRE_GROUP_COLORS[dreGroup] ?? DRE_GROUP_COLORS.OUTROS
}
