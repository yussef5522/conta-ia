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

// Sprint 5.0.2.s — Overrides POR SETOR. Quando empresa.setor está cadastrado,
// o engine consulta primeiro os overrides do setor e DEPOIS cai no array
// universal abaixo. Isso permite RESTAURANTE retornar "Matéria-Prima - Carnes"
// em vez de "Fornecedor Carnes" pra mesma keyword.
//
// Categorias setoriais DEVEM existir no plano de contas (criadas por
// ensureAllSystemCategories quando setor é setado).
export const SETOR_OVERRIDES: Record<
  string,
  ReadonlyArray<KeywordCategoryMapping>
> = {
  RESTAURANTE: [
    { keywords: ['EMBALAGEM', 'EMBALAGENS', 'PACKAGING'], category: 'Embalagens - Descartáveis', confidence: 0.88 },
    { keywords: ['CONSERVAS'], category: 'Matéria-Prima - Outros Insumos', confidence: 0.88 },
    { keywords: ['HORTIFRUTI', 'HORTIFRUTIGRANJEIROS', 'FRUTAS E LEGUMES', 'LEGUMES'], category: 'Matéria-Prima - Hortifruti', confidence: 0.92 },
    { keywords: ['PADARIA', 'CONFEITARIA', 'PANIFICADORA'], category: 'Matéria-Prima - Outros Insumos', confidence: 0.88 },
    { keywords: ['PRODUTOS ALIMENTICIOS', 'ALIMENTOS', 'ALIMENTICIOS', 'ALIMENTAR'], category: 'Matéria-Prima - Outros Insumos', confidence: 0.88 },
    { keywords: ['BEBIDAS', 'CERVEJARIA', 'REFRIGERANTE'], category: 'Matéria-Prima - Bebidas', confidence: 0.92 },
    { keywords: ['CARNES', 'FRIGORIFICO', 'AVICOLA', 'BOVINOS', 'SUINOS', 'AVIARIO'], category: 'Matéria-Prima - Carnes', confidence: 0.92 },
    { keywords: ['ATACADO', 'ATACADISTA'], category: 'Matéria-Prima - Outros Insumos', confidence: 0.82 },
    { keywords: ['DISTRIBUIDORA', 'DISTRIBUIDOR'], category: 'Matéria-Prima - Outros Insumos', confidence: 0.78 },
  ],
  ACADEMIA: [
    { keywords: ['SUPLEMENTOS', 'SUPLEMENTO', 'WHEY', 'CREATINA'], category: 'Mercadoria Revenda - Suplementos', confidence: 0.92 },
    { keywords: ['EQUIPAMENTO ACADEMIA', 'EQUIPAMENTOS ACADEMIA'], category: 'Equipamentos Academia', confidence: 0.9 },
  ],
  COMERCIO_ROUPA: [
    { keywords: ['CONFECCAO', 'CONFECCOES', 'TEXTIL'], category: 'Mercadoria Revenda - Confecções', confidence: 0.92 },
    { keywords: ['ATACADO', 'ATACADISTA'], category: 'Mercadoria Revenda - Confecções', confidence: 0.82 },
    { keywords: ['DISTRIBUIDORA', 'DISTRIBUIDOR'], category: 'Mercadoria Revenda - Confecções', confidence: 0.78 },
  ],
  VAREJO_GERAL: [
    // Sem overrides — usa lista universal abaixo
  ],
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

function sortByConfidenceDesc(
  list: ReadonlyArray<KeywordCategoryMapping>,
): KeywordCategoryMapping[] {
  return [...list]
    .map((m) => ({
      ...m,
      longestKw: Math.max(...m.keywords.map((k) => k.length)),
    }))
    .sort((a, b) => {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence
      return b.longestKw - a.longestKw
    })
}

// Pre-sorted por (confidence desc, keyword length desc) pra match mais
// específico primeiro
const SORTED_MAPPINGS = sortByConfidenceDesc(RAZAO_SOCIAL_KEYWORDS_BR)
const SORTED_OVERRIDES: Record<string, KeywordCategoryMapping[]> = Object.fromEntries(
  Object.entries(SETOR_OVERRIDES).map(([setor, list]) => [
    setor,
    sortByConfidenceDesc(list),
  ]),
)

/**
 * Tenta categorizar pela razão social.
 *
 * Estratégia (Sprint 5.0.2.s):
 *   1. Se `setor` setado E tem override pra ele → consulta overrides primeiro
 *   2. Fallback: lista universal RAZAO_SOCIAL_KEYWORDS_BR
 *
 * - SÓ roda em DEBIT (despesas) — para CREDIT a heurística não é confiável.
 * - Retorna o PRIMEIRO match (mais confiante + mais específico).
 * - Retorna null se nada bate.
 */
export function matchByRazaoSocialKeywords(
  description: string | null | undefined,
  type: 'DEBIT' | 'CREDIT' | string,
  setor?: string | null,
): KeywordMatchResult | null {
  if (!description) return null
  if (type !== 'DEBIT') return null

  const desc = normalizeDescUpper(description)

  // 1. Setor overrides
  if (setor && SORTED_OVERRIDES[setor]) {
    for (const mapping of SORTED_OVERRIDES[setor]) {
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
  }

  // 2. Universal fallback
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
