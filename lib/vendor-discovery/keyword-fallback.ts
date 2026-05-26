// Sprint 5.0.2.o — Keyword fallback BR para Vendor Discovery.
//
// Roda APÓS Cache Global e BrasilAPI, ANTES do Claude AI.
// Mais barato, mais rápido, e melhor pra casos óbvios em que a razão social
// CONTÉM a categoria explícita ("BEBIDAS", "EMBALAGENS", "CONSERVAS").
//
// Tudo PURO/testável (sem DB).

export interface KeywordCategoryMapping {
  /** Palavras-chave (UPPERCASE, sem acentos) que disparam o mapping. */
  keywords: ReadonlyArray<string>
  category: string
  /** 0.0-1.0 — categoria mais específica = confidence mais alta */
  confidence: number
}

export const RAZAO_SOCIAL_KEYWORDS_BR: ReadonlyArray<KeywordCategoryMapping> = [
  // ─────────────────────────────────────────────────────────
  // EMBALAGENS / MATERIAIS
  // ─────────────────────────────────────────────────────────
  { keywords: ['EMBALAGEM', 'EMBALAGENS', 'PACKAGING'], category: 'Material de Embalagem', confidence: 0.88 },

  // ─────────────────────────────────────────────────────────
  // ALIMENTOS
  // ─────────────────────────────────────────────────────────
  { keywords: ['CONSERVAS'], category: 'Fornecedor Alimentos', confidence: 0.88 },
  { keywords: ['HORTIFRUTI', 'HORTIFRUTIGRANJEIROS', 'FRUTAS E LEGUMES', 'LEGUMES'], category: 'Hortifruti', confidence: 0.9 },
  { keywords: ['PADARIA', 'CONFEITARIA', 'PANIFICADORA'], category: 'Padaria', confidence: 0.9 },
  { keywords: ['PRODUTOS ALIMENTICIOS', 'ALIMENTOS', 'ALIMENTICIOS', 'ALIMENTAR'], category: 'Fornecedor Alimentos', confidence: 0.85 },

  // ─────────────────────────────────────────────────────────
  // BEBIDAS
  // ─────────────────────────────────────────────────────────
  { keywords: ['BEBIDAS', 'CERVEJARIA', 'REFRIGERANTE'], category: 'Fornecedor Bebidas', confidence: 0.9 },

  // ─────────────────────────────────────────────────────────
  // CARNES
  // ─────────────────────────────────────────────────────────
  { keywords: ['CARNES', 'FRIGORIFICO', 'AVICOLA', 'BOVINOS', 'SUINOS', 'AVIARIO'], category: 'Fornecedor Carnes', confidence: 0.9 },

  // ─────────────────────────────────────────────────────────
  // TECNOLOGIA (mais específico antes do genérico)
  // ─────────────────────────────────────────────────────────
  { keywords: ['TECNOPONTO'], category: 'Software/Tecnologia', confidence: 0.95 },
  { keywords: ['PONTO ELETRONICO', 'CONTROLE DE PONTO', 'CONTROL DE P'], category: 'Software/Tecnologia', confidence: 0.92 },
  { keywords: ['SOFTWARE', 'SISTEMAS', 'TECNOLOGIA', 'INFORMATICA'], category: 'Software/Tecnologia', confidence: 0.88 },

  // ─────────────────────────────────────────────────────────
  // COMBUSTÍVEL
  // ─────────────────────────────────────────────────────────
  { keywords: ['POSTO ', 'COMBUSTIVEIS', 'COMBUSTIVEL'], category: 'Combustível', confidence: 0.9 },

  // ─────────────────────────────────────────────────────────
  // TRANSPORTE / FRETE
  // ─────────────────────────────────────────────────────────
  { keywords: ['TRANSPORTADORA', 'LOGISTICA', 'TRANSPORTES'], category: 'Frete', confidence: 0.85 },

  // ─────────────────────────────────────────────────────────
  // SERVIÇOS PROFISSIONAIS
  // ─────────────────────────────────────────────────────────
  { keywords: ['CONTABILIDADE', 'ESCRITORIO CONTABIL', 'CONTADOR'], category: 'Honorários Contábeis', confidence: 0.95 },
  { keywords: ['ADVOCACIA', 'ADVOGADOS', 'JURIDICO'], category: 'Honorários Jurídicos', confidence: 0.95 },
  { keywords: ['ENGENHARIA', 'CONSTRUTORA'], category: 'Serviços de Engenharia', confidence: 0.85 },

  // ─────────────────────────────────────────────────────────
  // SAÚDE
  // ─────────────────────────────────────────────────────────
  { keywords: ['CLINICA', 'HOSPITAL', 'CONSULTORIO MEDICO'], category: 'Saúde', confidence: 0.88 },
  { keywords: ['FARMACIA', 'DROGARIA'], category: 'Material Médico', confidence: 0.88 },

  // ─────────────────────────────────────────────────────────
  // IMOBILIÁRIO
  // ─────────────────────────────────────────────────────────
  { keywords: ['IMOBILIARIA', 'IMOVEIS LTDA'], category: 'Aluguel', confidence: 0.85 },

  // ─────────────────────────────────────────────────────────
  // MARKETING / PUBLICIDADE
  // ─────────────────────────────────────────────────────────
  { keywords: ['MARKETING', 'PUBLICIDADE', 'PROPAGANDA', 'AGENCIA DE'], category: 'Marketing Digital', confidence: 0.85 },

  // ─────────────────────────────────────────────────────────
  // LIMPEZA / SEGURANÇA
  // ─────────────────────────────────────────────────────────
  { keywords: ['LIMPEZA', 'CONSERVACAO E LIMPEZA', 'HIGIENE'], category: 'Material de Limpeza', confidence: 0.85 },
  { keywords: ['SEGURANCA PATRIMONIAL', 'VIGILANCIA'], category: 'Segurança', confidence: 0.88 },

  // ─────────────────────────────────────────────────────────
  // MATERIAIS
  // ─────────────────────────────────────────────────────────
  { keywords: ['MATERIAIS ELETRICOS', 'MAT ELETRICO'], category: 'Material Elétrico', confidence: 0.85 },
  { keywords: ['MATERIAIS DE CONSTRUCAO', 'MAT CONSTRUCAO'], category: 'Material de Construção', confidence: 0.82 },
  { keywords: ['AUTO PECAS', 'AUTOPECAS', 'PECAS AUTOMOTIVAS'], category: 'Manutenção Veículos', confidence: 0.88 },
  { keywords: ['OFICINA MECANICA', 'MECANICA DE AUTOS'], category: 'Manutenção Veículos', confidence: 0.85 },

  // ─────────────────────────────────────────────────────────
  // ATACADO / DISTRIBUIDOR (genéricos — confidence baixa)
  // Vem por último pra não competir com mais específicos acima.
  // ─────────────────────────────────────────────────────────
  { keywords: ['ATACADO', 'ATACADISTA'], category: 'Compras Mercadoria', confidence: 0.8 },
  { keywords: ['DISTRIBUIDORA', 'DISTRIBUIDOR'], category: 'Compras Mercadoria', confidence: 0.75 },
]

export interface KeywordMatchResult {
  category: string
  confidence: number
  matchedKeyword: string
}

/**
 * Normaliza descrição: UPPERCASE + remove acentos. Mantém espaços.
 * Reusa lógica de normalizeVendorName mas SEM colapsar pontuação interna
 * pra preservar matches de keywords com espaço ("CONTROL DE P").
 */
function normalizeDescUpper(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
}

// Pre-sorted por (confidence desc, keyword length desc) pra match mais
// específico primeiro
const SORTED_MAPPINGS = [...RAZAO_SOCIAL_KEYWORDS_BR]
  .map((m) => ({
    ...m,
    // Tamanho da MAIOR keyword do mapping (proxy de especificidade)
    longestKw: Math.max(...m.keywords.map((k) => k.length)),
  }))
  .sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence
    return b.longestKw - a.longestKw
  })

/**
 * Tenta categorizar pela razão social.
 *
 * - SÓ roda em DEBIT (despesas) — para CREDIT a heurística não é confiável.
 * - Retorna o PRIMEIRO match (mais confiante + mais específico).
 * - Retorna null se nada bate.
 */
export function matchByRazaoSocialKeywords(
  description: string | null | undefined,
  type: 'DEBIT' | 'CREDIT' | string,
): KeywordMatchResult | null {
  if (!description) return null
  if (type !== 'DEBIT') return null

  const desc = normalizeDescUpper(description)

  for (const mapping of SORTED_MAPPINGS) {
    for (const kw of mapping.keywords) {
      if (desc.includes(kw)) {
        return {
          category: mapping.category,
          confidence: mapping.confidence,
          matchedKeyword: kw,
        }
      }
    }
  }

  return null
}
