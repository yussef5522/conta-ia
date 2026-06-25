// Sprint Cartao R2 (24/06/2026) — fuzzy match entre nome sugerido pela IA
// e categorias EXPENSE da empresa. PURO, testavel sem DB.
//
// Estrategia em camadas:
//   1. Match EXACT (case-insensitive, accent-insensitive)
//   2. Match por SUBSTRING (sugestao contida no nome OU vice-versa)
//   3. Match por TOKENS (todas as palavras significativas batem)
//   4. Sem match -> null
//
// Confianca:
//   - EXACT: 0.95
//   - SUBSTRING: 0.85
//   - TOKENS: 0.75

export interface CategoryForMatch {
  id: string
  name: string
  type: string // 'EXPENSE' | 'INCOME' | 'TRANSFER'
}

export interface FuzzyMatchResult {
  categoryId: string
  confidence: number
  matchType: 'EXACT' | 'SUBSTRING' | 'TOKENS'
  matchedName: string
}

const STOP_WORDS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'a', 'o', 'e', 'em', 'para', 'com',
  'sem', 'por', 'sob', 'sobre', 'na', 'no', 'nas', 'nos',
])

/**
 * Match a sugestao da IA (string livre) contra categorias EXPENSE da empresa.
 * Retorna null se nao houver match com confianca suficiente.
 */
export function fuzzyMatchCategory(
  suggestion: string,
  categories: ReadonlyArray<CategoryForMatch>,
): FuzzyMatchResult | null {
  if (!suggestion || suggestion.trim().length === 0) return null

  const expenseCats = categories.filter((c) => c.type === 'EXPENSE')
  if (expenseCats.length === 0) return null

  const suggNorm = normalize(suggestion)

  // 1) EXACT
  for (const c of expenseCats) {
    if (normalize(c.name) === suggNorm) {
      return { categoryId: c.id, confidence: 0.95, matchType: 'EXACT', matchedName: c.name }
    }
  }

  // 2) SUBSTRING (sugestão dentro do nome OU nome dentro da sugestão)
  // Prefere o match mais especifico (nome mais longo bate primeiro)
  const ordered = [...expenseCats].sort((a, b) => b.name.length - a.name.length)
  for (const c of ordered) {
    const catNorm = normalize(c.name)
    if (catNorm.length < 3) continue
    if (catNorm.includes(suggNorm) || suggNorm.includes(catNorm)) {
      return { categoryId: c.id, confidence: 0.85, matchType: 'SUBSTRING', matchedName: c.name }
    }
  }

  // 3) TOKENS — todas as palavras significativas da sugestao precisam estar na categoria
  const suggTokens = tokenize(suggNorm)
  if (suggTokens.length === 0) return null

  let bestMatch: { cat: CategoryForMatch; score: number } | null = null
  for (const c of expenseCats) {
    const catTokens = new Set(tokenize(normalize(c.name)))
    if (catTokens.size === 0) continue
    let hits = 0
    for (const t of suggTokens) {
      if (catTokens.has(t)) hits++
    }
    const score = hits / suggTokens.length
    // Exige >=70% das palavras da sugestao na categoria (ou >=80% pra categorias curtas)
    const minScore = catTokens.size <= 2 ? 0.8 : 0.7
    if (score >= minScore) {
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { cat: c, score }
      }
    }
  }
  if (bestMatch) {
    return {
      categoryId: bestMatch.cat.id,
      confidence: 0.75 * bestMatch.score,
      matchType: 'TOKENS',
      matchedName: bestMatch.cat.name,
    }
  }

  return null
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(s: string): string[] {
  return s
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOP_WORDS.has(t))
}
