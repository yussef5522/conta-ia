// Sprint Retirada-Despesa-PF — Sugestão de categoria PF de despesa
// baseada na descrição da tx PJ que originou a retirada.
//
// PRINCÍPIO: só sugere quando keyword é ÓBVIA (confidence ≥ 0.85).
// Quando não sabe, retorna null — UI mostra dropdown vazio + dono escolhe.
// NUNCA cria sozinho. Sempre o dono confirma.
//
// FUNÇÃO PURA — sem DB, sem rede.
//
// Mapeia pelo NOME da categoria (não ID) — sistema acha o categoryId real
// na hora (categorias podem ter sido renomeadas/desativadas no perfil).

export interface SpendCategorySuggestion {
  /** Nome da categoria PF a procurar no plano do perfil. */
  categoryName: string
  /** 0.85-1.00 — só sugere quando muito confiante. */
  confidence: number
  /** Keyword que casou (debug/audit). */
  matchedKeyword: string
}

interface KeywordRule {
  regex: RegExp
  categoryName: string
  confidence: number
}

// Ordem importa: regras mais específicas primeiro.
// Regex case-insensitive via flag `i`.
const KEYWORD_RULES: KeywordRule[] = [
  // Educação
  {
    regex: /\b(ESCOLA|COL[EÉ]GIO|MENSALIDADE|COOPERATIVA[\s\w]*PAIS|CRECHE|UNIVERSIDADE|FACULDADE|CURSO|VESTIBULAR)\b/i,
    categoryName: 'Educação',
    confidence: 0.9,
  },
  // Telefone/Celular (categoria nova — 13ª default)
  {
    regex: /\b(RECARGA[\s\w]*(TELEFONE|CELULAR)|CONTA[\s\w]*CELULAR|TIM(\s|$)|VIVO\s+M[ÓO]VEL|CLARO[\s]+M[ÓO]VEL|RECARGA\s+TIM|RECARGA\s+VIVO|RECARGA\s+CLARO|RECARGA\s+OI)\b/i,
    categoryName: 'Telefone/Celular',
    confidence: 0.9,
  },
  // Energia/Água/Internet (categoria "Contas (luz, água, internet)")
  {
    regex: /\b(ENERGIA|CEMIG|COPEL|SABESP|COMGAS|CORSAN|VIVO\s+FIBRA|NET\s+CLARO|GVT|INTERNET|BANDA\s+LARGA|CONTA\s+DE\s+LUZ|CONTA\s+DE\s+[AÁ]GUA)\b/i,
    categoryName: 'Contas (luz, água, internet)',
    confidence: 0.9,
  },
  // Transporte
  {
    regex: /\b(POSTO\s|COMBUST[IÍ]VEL|GASOLINA|[EE]TANOL|UBER(\s|$)|99(\s|TAXI)|IPVA|LICENCIAMENTO|ESTACIONAMENTO|PED[AÁ]GIO)\b/i,
    categoryName: 'Transporte',
    confidence: 0.85,
  },
  // Alimentação
  {
    regex: /\b(MERCADO|SUPERMERCADO|ATACAD[AÃ]O|ASSAI|CARREFOUR|EXTRA|PAO\s+DE\s+ACUCAR|IFOOD|RESTAURANTE|PADARIA|HORTIFRUTI)\b/i,
    categoryName: 'Alimentação',
    confidence: 0.85,
  },
  // Saúde
  {
    regex: /\b(FARM[AÁ]CIA|DROGARIA|DROGA\s?RAIA|DROGASIL|PACHECO|UNIMED|AMIL|BRADESCO\s+SA[UÚ]DE|HOSPITAL|CL[IÍ]NICA|LABORAT[OÓ]RIO|EXAME)\b/i,
    categoryName: 'Saúde',
    confidence: 0.85,
  },
  // Moradia
  {
    regex: /\b(ALUGUEL|CONDOM[IÍ]NIO|IPTU|IMOBILI[AÁ]RIA)\b/i,
    categoryName: 'Moradia',
    confidence: 0.9,
  },
  // Lazer
  {
    regex: /\b(NETFLIX|SPOTIFY|DISNEY\+?|DEEZER|HBO|PRIME\s+VIDEO|CINEMA|INGRESSO|TEATRO|SHOW|PARQUE)\b/i,
    categoryName: 'Lazer',
    confidence: 0.85,
  },
  // Vestuário
  {
    regex: /\b(ZARA|RIACHUELO|RENNER|LEADER|C&A|MARISA|HERING)\b/i,
    categoryName: 'Vestuário',
    confidence: 0.85,
  },
]

/**
 * Sugere categoria PF de despesa pra uma retirada baseada na descrição PJ.
 * Retorna null quando nenhuma keyword casa ou descrição é genérica demais
 * (PIX SOLANGE, LATSCH, PIX ENVIADO).
 */
export function suggestSpendCategory(
  pjDescription: string | null | undefined,
): SpendCategorySuggestion | null {
  if (!pjDescription) return null
  const desc = pjDescription.trim()
  if (desc.length === 0) return null

  // Sufixos comuns que adicionamos na criação da ponte ("· DD/MM/YYYY")
  // são ignorados naturalmente — a regex casa o trecho identificador.

  for (const rule of KEYWORD_RULES) {
    const match = desc.match(rule.regex)
    if (match) {
      return {
        categoryName: rule.categoryName,
        confidence: rule.confidence,
        matchedKeyword: match[0],
      }
    }
  }
  return null
}
