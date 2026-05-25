// Sprint 5.0.2.b — Index de expertise por ramo.

import { EXPERTISE_RESTAURANTES, CNAES_RESTAURANTES } from './restaurantes'
import { EXPERTISE_ACADEMIAS, CNAES_ACADEMIAS } from './academias'
import { EXPERTISE_COMERCIO_ROUPA, CNAES_COMERCIO_ROUPA } from './comercio-roupa'
import type { CNAEEntry, ExpertiseRamo, Ramo } from './types'

export * from './types'
export { EXPERTISE_RESTAURANTES, CNAES_RESTAURANTES } from './restaurantes'
export { EXPERTISE_ACADEMIAS, CNAES_ACADEMIAS } from './academias'
export { EXPERTISE_COMERCIO_ROUPA, CNAES_COMERCIO_ROUPA } from './comercio-roupa'

export const ALL_EXPERTISE: Record<Ramo, ExpertiseRamo> = {
  RESTAURANTE: EXPERTISE_RESTAURANTES,
  ACADEMIA: EXPERTISE_ACADEMIAS,
  COMERCIO_ROUPA: EXPERTISE_COMERCIO_ROUPA,
}

export const ALL_CNAES: Array<CNAEEntry & { ramo: Ramo }> = [
  ...CNAES_RESTAURANTES.map((c) => ({ ...c, ramo: 'RESTAURANTE' as const })),
  ...CNAES_ACADEMIAS.map((c) => ({ ...c, ramo: 'ACADEMIA' as const })),
  ...CNAES_COMERCIO_ROUPA.map((c) => ({ ...c, ramo: 'COMERCIO_ROUPA' as const })),
]

export const RAMO_LABELS: Record<Ramo, string> = {
  RESTAURANTE: 'Restaurantes',
  ACADEMIA: 'Academias / Fitness',
  COMERCIO_ROUPA: 'Comércio de Roupas',
}

/**
 * Busca CNAE pelo código exato. Retorna null se não cadastrado.
 */
export function findCNAE(code: string): (CNAEEntry & { ramo: Ramo }) | null {
  return ALL_CNAES.find((c) => c.code === code) ?? null
}

/**
 * Retorna expertise do ramo correspondente ao CNAE (ou null).
 */
export function expertiseForCNAE(code: string): ExpertiseRamo | null {
  const c = findCNAE(code)
  return c ? ALL_EXPERTISE[c.ramo] : null
}

/**
 * Normaliza string pra busca (lowercase + remove acentos).
 */
function normalize(s: string): string {
  // ̀-ͯ = combining diacritical marks (acentos)
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/**
 * Search por código (substring), nome (normalizado) OU aliases (normalizado).
 * Opcionalmente filtra por ramo. Retorna até `limit` resultados.
 */
export function searchCNAEs(
  query: string,
  limit = 20,
  ramo?: Ramo,
): Array<CNAEEntry & { ramo: Ramo }> {
  const base = ramo ? ALL_CNAES.filter((c) => c.ramo === ramo) : ALL_CNAES
  const q = query.trim().toLowerCase()
  if (!q) return base.slice(0, limit)

  const nq = normalize(q)
  return base
    .filter((c) => {
      if (c.code.toLowerCase().includes(q)) return true
      if (normalize(c.name).includes(nq)) return true
      if (c.aliases?.some((a) => normalize(a).includes(nq))) return true
      return false
    })
    .slice(0, limit)
}

/**
 * Contagem de CNAEs por ramo (pra chips de filtro).
 */
export function countCNAEsByRamo(): Record<Ramo, number> {
  return {
    RESTAURANTE: CNAES_RESTAURANTES.length,
    ACADEMIA: CNAES_ACADEMIAS.length,
    COMERCIO_ROUPA: CNAES_COMERCIO_ROUPA.length,
  }
}

export const RAMO_ICONS: Record<Ramo, string> = {
  RESTAURANTE: '🍔',
  ACADEMIA: '💪',
  COMERCIO_ROUPA: '🛒',
}
