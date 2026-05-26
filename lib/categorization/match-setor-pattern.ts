// Sprint 5.0.2.l — Engine de match de padrões setoriais (DB-backed).
//
// matchSetorPattern: dada uma descrição + tipo + setor da empresa, busca
// na KB de SetorPattern o primeiro padrão que casa.
//
// Estratégia:
//   1. Filtra padrões active=true E setor IN ('UNIVERSAL', empresaSetor)
//   2. Ordena por (setor === empresaSetor primeiro, depois UNIVERSAL),
//      depois por confidence desc, depois por length(pattern) desc
//   3. Itera e retorna o primeiro match
//
// Cache: snapshot da KB carregado em memória por instância de Node.
// Invalidação manual via clearSetorPatternsCache() — admin pode chamar
// após mexer na KB.

import { prisma } from '@/lib/db'

export type MatchTypeEnum = 'STARTS_WITH' | 'CONTAINS' | 'EQUALS'
export type SetorPatternTypeEnum = 'INCOME' | 'EXPENSE' | 'ANY'

export interface SetorPatternSnapshot {
  id: string
  setor: string
  matchType: MatchTypeEnum
  pattern: string
  categoryName: string
  type: SetorPatternTypeEnum
  confidence: number
}

/** Tier AUTO ≥0.90; SUGGEST <0.90 — só categoriza no bulk retroativo. */
export const SETOR_AUTO_THRESHOLD = 0.9
export type SetorApplyTier = 'AUTO' | 'SUGGEST'

interface CacheEntry {
  loadedAt: number
  patterns: SetorPatternSnapshot[]
}
const CACHE_TTL_MS = 60_000 // 60s — invalida automático
const cache = new Map<string, CacheEntry>()

/** Cache key by setor (UNIVERSAL + empresa setor são pre-merge no carregamento). */
function cacheKeyFor(setorEmpresa: string | null): string {
  return setorEmpresa ?? '__none__'
}

/**
 * Carrega padrões UNIVERSAL + os do setor da empresa do DB.
 * Pre-ordena por (setor empresa primeiro → UNIVERSAL → confidence → length).
 */
async function loadPatternsForSetor(
  setorEmpresa: string | null,
): Promise<SetorPatternSnapshot[]> {
  const key = cacheKeyFor(setorEmpresa)
  const cached = cache.get(key)
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
    return cached.patterns
  }

  const setores =
    setorEmpresa && setorEmpresa !== 'UNIVERSAL'
      ? ['UNIVERSAL', setorEmpresa]
      : ['UNIVERSAL']

  const rows = await prisma.setorPattern.findMany({
    where: {
      active: true,
      setor: { in: setores },
    },
    select: {
      id: true,
      setor: true,
      matchType: true,
      pattern: true,
      categoryName: true,
      type: true,
      confidence: true,
    },
  })

  // Ordenação: setor empresa específico > UNIVERSAL, então confidence desc,
  // então pattern length desc (mais específico primeiro).
  const setorEmpresaNonNull = setorEmpresa ?? ''
  const sorted: SetorPatternSnapshot[] = rows
    .map((r) => ({
      id: r.id,
      setor: r.setor,
      matchType: r.matchType as MatchTypeEnum,
      pattern: r.pattern,
      categoryName: r.categoryName,
      type: r.type as SetorPatternTypeEnum,
      confidence: r.confidence,
    }))
    .sort((a, b) => {
      const aMatch = a.setor === setorEmpresaNonNull ? 1 : 0
      const bMatch = b.setor === setorEmpresaNonNull ? 1 : 0
      if (aMatch !== bMatch) return bMatch - aMatch
      if (b.confidence !== a.confidence) return b.confidence - a.confidence
      return b.pattern.length - a.pattern.length
    })

  cache.set(key, { loadedAt: Date.now(), patterns: sorted })
  return sorted
}

export function clearSetorPatternsCache() {
  cache.clear()
}

export interface MatchSetorInput {
  description: string | null | undefined
  /** 'CREDIT' = INCOME; 'DEBIT' = EXPENSE; 'TRANSFER'/outros = ignora. */
  type: string | null | undefined
}

export interface MatchSetorResult {
  pattern: SetorPatternSnapshot
  tier: SetorApplyTier
}

/**
 * Match em memória usando snapshot pre-carregado (caller passa o snapshot).
 * Função PURA — testável sem DB.
 */
export function matchAgainstPatterns(
  input: MatchSetorInput,
  patterns: SetorPatternSnapshot[],
): MatchSetorResult | null {
  if (!input.description) return null
  const desc = input.description.toUpperCase()
  const txCat: 'INCOME' | 'EXPENSE' | null =
    input.type === 'CREDIT'
      ? 'INCOME'
      : input.type === 'DEBIT'
        ? 'EXPENSE'
        : null

  for (const p of patterns) {
    if (p.type !== 'ANY') {
      if (txCat === null) continue
      if (p.type !== txCat) continue
    }
    const matched = (() => {
      switch (p.matchType) {
        case 'STARTS_WITH':
          return desc.startsWith(p.pattern)
        case 'CONTAINS':
          return desc.includes(p.pattern)
        case 'EQUALS':
          return desc.trim() === p.pattern
      }
    })()
    if (matched) {
      return {
        pattern: p,
        tier: p.confidence >= SETOR_AUTO_THRESHOLD ? 'AUTO' : 'SUGGEST',
      }
    }
  }
  return null
}

/**
 * Wrapper async que carrega patterns + faz o match.
 * Use loadPatternsForSetor + matchAgainstPatterns separados em loops grandes
 * pra evitar 1 round trip por tx.
 */
export async function matchSetorPattern(
  input: MatchSetorInput,
  setorEmpresa: string | null,
): Promise<MatchSetorResult | null> {
  const patterns = await loadPatternsForSetor(setorEmpresa)
  return matchAgainstPatterns(input, patterns)
}

export { loadPatternsForSetor }

/**
 * Resolve categoryId pra match setorial.
 * Estratégia:
 *   1. Match exato por nome (case-insensitive trim)
 *   2. Match parcial — categoria contém o hint (sem checar dreGroup aqui;
 *      categorias setoriais são criadas pelo ensureAllSystemCategoriesForSetor)
 *   3. null se nada bater
 */
export function resolveSetorCategoryId(
  categories: Array<{ id: string; name: string; isActive: boolean }>,
  categoryName: string,
): string | null {
  const target = categoryName.toLowerCase().trim()
  const byName = categories.find(
    (c) => c.isActive && c.name.toLowerCase().trim() === target,
  )
  if (byName) return byName.id
  const byPartial = categories.find(
    (c) => c.isActive && c.name.toLowerCase().includes(target),
  )
  return byPartial?.id ?? null
}
