// Sprint 5.0.2.0 — Mapeia centros de custo (texto livre da planilha) pra
// Category do plano de contas setorial (Sprint s).
//
// Estratégia:
//   1. Match local primeiro (zero custo):
//      - Equals normalizado (CC.toLowerCase().trim() === cat.name.toLowerCase())
//      - Contém (cat.name in cc OU vice-versa, palavras inteiras)
//   2. Match keyword setorial (SetorPattern por nome de categoria)
//      - "Salário Professor" → "Salários" (universal)
//      - "Exame Ocupacional" → "Serviços PF" (setor restaurante) ou similar
//   3. Tudo o que não casa em 1 ou 2 → propõe categoria nova com nome do CC
//
// Saída: map de centroCusto (string) → resultado de mapeamento.

import type { Category } from '@prisma/client'

export interface MapCategoriesInput {
  /** Centros de custo únicos detectados na planilha. */
  centrosCusto: string[]
  /** Plano de contas atual da empresa (já carregado). */
  categoriasEmpresa: Pick<Category, 'id' | 'name' | 'type' | 'dreGroup'>[]
}

export interface CategoryMapResult {
  centroCusto: string
  /** Quando match >0.7: ID da categoria existente. */
  matchedCategoryId: string | null
  /** Nome da categoria existente quando match (pra UI). */
  matchedCategoryName: string | null
  /** Quando NÃO match: nome proposto pra criar no confirm. */
  proposedCategoryName: string | null
  /** 0-1 — confiança do match (0 quando proposta). */
  confidence: number
  /** Estratégia que pegou (debug). */
  reason: string
}

// ──────────────────────────────────────────────────────────────────────
// HELPERS PUROS
// ──────────────────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Tokens significativos pra comparação (3+ chars, não-stopword).
 */
function tokens(s: string): Set<string> {
  const STOP = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'para', 'com', 'em', 'a', 'o'])
  return new Set(
    normalize(s)
      .split(' ')
      .filter((t) => t.length >= 3 && !STOP.has(t)),
  )
}

/** Jaccard-like: interseção / união de tokens. */
function tokenSimilarity(a: string, b: string): number {
  const ta = tokens(a)
  const tb = tokens(b)
  if (ta.size === 0 || tb.size === 0) return 0
  let inter = 0
  for (const t of ta) if (tb.has(t)) inter++
  const union = new Set([...ta, ...tb]).size
  return inter / union
}

// ──────────────────────────────────────────────────────────────────────
// HINTS SETORIAIS — mapeamento curated de termos comuns BR
// ──────────────────────────────────────────────────────────────────────

/**
 * Hints universais: centro de custo → nome de categoria preferida.
 * Caller resolve o categoryId pelo nome dentro de categoriasEmpresa.
 */
const HINTS: ReadonlyArray<{ regex: RegExp; categoryName: string }> = [
  // Folha
  { regex: /folha\s+(de\s+)?pagamento|folha\s+\w+\s+ano|pag\s+folha/i, categoryName: 'Salários' },
  { regex: /^sal[áa]rio/i, categoryName: 'Salários' },
  { regex: /vale\s+transporte|VT\b/i, categoryName: 'Vale Transporte' },
  { regex: /vale\s+alimenta/i, categoryName: 'Vale Alimentação' },
  { regex: /vale\s+refei/i, categoryName: 'Vale Refeição' },
  { regex: /13[°ºo]?\s*sal[áa]rio|d[ée]cimo\s*terceiro/i, categoryName: 'Salários' },
  { regex: /f[ée]rias/i, categoryName: 'Salários' },
  // Tributos
  { regex: /\bdas\b\s*(simples)?/i, categoryName: 'DAS Simples Nacional' },
  { regex: /\binss\b/i, categoryName: 'INSS' },
  { regex: /\bfgts\b/i, categoryName: 'FGTS' },
  { regex: /\bdarf\b|tribut/i, categoryName: 'Tributos Federais' },
  { regex: /\biss\b/i, categoryName: 'ISS' },
  { regex: /\bipva\b/i, categoryName: 'IPVA' },
  { regex: /\biptu\b/i, categoryName: 'IPTU' },
  // Bancárias
  { regex: /tarifa\s*banc|tarifa\s*pix|tarifa\s*ted/i, categoryName: 'Tarifas Bancárias' },
  { regex: /juros|encargos/i, categoryName: 'Juros e Encargos' },
  // Utilidades
  { regex: /energia|luz/i, categoryName: 'Energia Elétrica' },
  { regex: /[áa]gua\s+e?\s*esgoto|saneamento/i, categoryName: 'Água e Esgoto' },
  { regex: /telefon|internet|wifi/i, categoryName: 'Telefonia e Internet' },
  { regex: /\bg[áa]s\b/i, categoryName: 'Gás' },
  // Operacionais
  { regex: /aluguel/i, categoryName: 'Aluguel' },
  { regex: /condom[íi]nio/i, categoryName: 'Condomínio' },
  { regex: /combust[íi]vel|gasolina|diesel/i, categoryName: 'Combustível' },
  { regex: /\bfrete\b|correios/i, categoryName: 'Frete' },
  // Tech / Marketing
  { regex: /software|tecnologia|inform[áa]tica|hospedagem/i, categoryName: 'Software/Tecnologia' },
  { regex: /assinatura|netflix|spotify|google|microsoft/i, categoryName: 'Assinaturas' },
  { regex: /marketing|publicidade|propaganda|facebook|google ads/i, categoryName: 'Marketing Digital' },
  // Profissionais
  { regex: /honor[áa]rios\s*cont[áa]beis|contabilidade/i, categoryName: 'Honorários Contábeis' },
  { regex: /honor[áa]rios\s*jur[íi]dicos|advoga/i, categoryName: 'Honorários Jurídicos' },
  { regex: /servi[çc]os?\s*p[ff]|aut[ôo]nomo|prestador/i, categoryName: 'Serviços PF (Prestadores)' },
  // Restaurante específico (mapeado por keyword no nome)
  { regex: /mat[ée]ria.?prima|insumo|alimento|comida|ingrediente/i, categoryName: 'Matéria-Prima - Outros Insumos' },
  { regex: /bebida|cerveja|refrigerante/i, categoryName: 'Matéria-Prima - Bebidas' },
  { regex: /carne|frigor[íi]fico/i, categoryName: 'Matéria-Prima - Carnes' },
  { regex: /hortifruti|fruta|legume/i, categoryName: 'Matéria-Prima - Hortifruti' },
  { regex: /embalag/i, categoryName: 'Embalagens - Descartáveis' },
  // Exame ocupacional (academia/restaurante)
  { regex: /exame\s*ocupacion|asoo?|admission/i, categoryName: 'Serviços PF (Prestadores)' },
  // Receitas (eventual)
  { regex: /receita\s+cart|cart[ãa]o\s*cr[ée]dito/i, categoryName: 'Receita Cartão' },
  { regex: /receita\s+pix/i, categoryName: 'Receita Pix' },
]

const MATCH_THRESHOLD = 0.55 // Jaccard token similarity

// ──────────────────────────────────────────────────────────────────────
// FUNÇÃO PRINCIPAL (PURA)
// ──────────────────────────────────────────────────────────────────────

export function mapCategories(input: MapCategoriesInput): CategoryMapResult[] {
  const results: CategoryMapResult[] = []
  const expenseCategories = input.categoriasEmpresa.filter(
    (c) => c.type === 'EXPENSE' || c.type === 'INCOME',
  )

  for (const cc of input.centrosCusto) {
    if (!cc || !cc.trim()) {
      results.push({
        centroCusto: cc,
        matchedCategoryId: null,
        matchedCategoryName: null,
        proposedCategoryName: null,
        confidence: 0,
        reason: 'Centro de custo vazio',
      })
      continue
    }

    // ESTRATÉGIA 1: equals normalizado
    const ccNorm = normalize(cc)
    const exactMatch = expenseCategories.find(
      (c) => normalize(c.name) === ccNorm,
    )
    if (exactMatch) {
      results.push({
        centroCusto: cc,
        matchedCategoryId: exactMatch.id,
        matchedCategoryName: exactMatch.name,
        proposedCategoryName: null,
        confidence: 1.0,
        reason: 'Match exato',
      })
      continue
    }

    // ESTRATÉGIA 2: hints regex setoriais
    let hintMatchName: string | null = null
    for (const h of HINTS) {
      if (h.regex.test(cc)) {
        hintMatchName = h.categoryName
        break
      }
    }
    if (hintMatchName) {
      const cat = expenseCategories.find(
        (c) => normalize(c.name) === normalize(hintMatchName!),
      )
      if (cat) {
        results.push({
          centroCusto: cc,
          matchedCategoryId: cat.id,
          matchedCategoryName: cat.name,
          proposedCategoryName: null,
          confidence: 0.92,
          reason: `Hint setorial: "${hintMatchName}"`,
        })
        continue
      }
      // Hint achou mas categoria não existe → propõe criar com nome do hint
      results.push({
        centroCusto: cc,
        matchedCategoryId: null,
        matchedCategoryName: null,
        proposedCategoryName: hintMatchName,
        confidence: 0.85,
        reason: `Hint propõe categoria nova: "${hintMatchName}"`,
      })
      continue
    }

    // ESTRATÉGIA 3: similaridade tokens (Jaccard)
    let bestMatch: { cat: (typeof expenseCategories)[number]; score: number } | null = null
    for (const cat of expenseCategories) {
      const score = tokenSimilarity(cc, cat.name)
      if (score > (bestMatch?.score ?? 0)) {
        bestMatch = { cat, score }
      }
    }

    if (bestMatch && bestMatch.score >= MATCH_THRESHOLD) {
      results.push({
        centroCusto: cc,
        matchedCategoryId: bestMatch.cat.id,
        matchedCategoryName: bestMatch.cat.name,
        proposedCategoryName: null,
        confidence: 0.6 + (bestMatch.score - MATCH_THRESHOLD) * 0.5,
        reason: `Similaridade tokens ${(bestMatch.score * 100).toFixed(0)}%`,
      })
      continue
    }

    // ESTRATÉGIA 4: sem match → propõe criar categoria com nome do CC
    results.push({
      centroCusto: cc,
      matchedCategoryId: null,
      matchedCategoryName: null,
      proposedCategoryName: cc.trim(),
      confidence: 0,
      reason: 'Sem match — propõe categoria nova',
    })
  }

  return results
}
