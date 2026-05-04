// Filtragem de árvore mantendo hierarquia. Função pura.

import type { CategoryNode } from './buildTree'

export interface CategoryFilters {
  search: string
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'ALL'
  dreGroup: string | 'ALL'
  status: 'ACTIVE' | 'INACTIVE' | 'ALL'
}

export const DEFAULT_FILTERS: CategoryFilters = {
  search: '',
  type: 'ALL',
  dreGroup: 'ALL',
  status: 'ACTIVE',
}

// Normaliza string pra busca: minúscula + remove acentos.
// Range U+0300..U+036F = Combining Diacritical Marks (acentos, til, cedilha).
const COMBINING_DIACRITICS = /[̀-ͯ]/g

function normalizar(s: string): string {
  return s.normalize('NFD').replace(COMBINING_DIACRITICS, '').toLowerCase().trim()
}

function categoriaBateFiltros(node: CategoryNode, filters: CategoryFilters): boolean {
  const q = normalizar(filters.search)
  if (q && !normalizar(node.name).includes(q)) return false

  if (filters.type !== 'ALL' && node.type !== filters.type) return false

  if (filters.dreGroup !== 'ALL' && node.dreGroup !== filters.dreGroup) return false

  if (filters.status === 'ACTIVE' && !node.isActive) return false
  if (filters.status === 'INACTIVE' && node.isActive) return false

  return true
}

// Filtra a árvore mantendo a hierarquia:
// - Se um filho bate, o pai é mantido (mesmo que pai não bata) — pra preservar contexto.
// - Se nada bate em uma subárvore, a subárvore inteira é removida.
export function filterTree(
  tree: CategoryNode[],
  filters: CategoryFilters,
): CategoryNode[] {
  const filtrados: CategoryNode[] = []

  for (const node of tree) {
    const filhosFiltrados = filterTree(node.children, filters)
    const ehMatch = categoriaBateFiltros(node, filters)

    if (ehMatch || filhosFiltrados.length > 0) {
      filtrados.push({ ...node, children: filhosFiltrados })
    }
  }

  return filtrados
}
