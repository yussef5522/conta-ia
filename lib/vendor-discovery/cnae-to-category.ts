// Sprint 5.0.2.n — Mapping CNAE → categoria contábil sugerida.
//
// Mais granular que `lib/ai-categorizer/cnae-mapping.ts` (que retorna dreGroup
// + categoryNameHint). Aqui retornamos nome de categoria PADRONIZADO usado
// pelo cache global, com confidence dedicada.
//
// Fonte: tabela CNAE Receita Federal (https://concla.ibge.gov.br/busca-online-cnae.html).

export interface CnaeCategoryMapping {
  cnaePrefix: string
  categoria: string
  confidence: number
  tipo?: 'INCOME' | 'EXPENSE' | 'ANY'
}

/** Lista CURATED ordenada — caller deve ordenar por length(prefix) DESC. */
export const CNAE_CATEGORY_MAP: ReadonlyArray<CnaeCategoryMapping> = [
  // Software/TI (62.xx)
  { cnaePrefix: '6201', categoria: 'Software/Tecnologia', confidence: 0.95 },
  { cnaePrefix: '6202', categoria: 'Software/Tecnologia', confidence: 0.95 },
  { cnaePrefix: '6203', categoria: 'Software/Tecnologia', confidence: 0.95 },
  { cnaePrefix: '6204', categoria: 'Software/Tecnologia', confidence: 0.95 },
  { cnaePrefix: '6209', categoria: 'Software/Tecnologia', confidence: 0.90 },
  { cnaePrefix: '6311', categoria: 'Software/Tecnologia', confidence: 0.90 },
  { cnaePrefix: '63', categoria: 'Software/Tecnologia', confidence: 0.85 },

  // Atacadistas alimentos/bebidas (46.xx)
  { cnaePrefix: '4611', categoria: 'Fornecedor Bebidas', confidence: 0.85 },
  { cnaePrefix: '4634', categoria: 'Fornecedor Carnes', confidence: 0.90 },
  { cnaePrefix: '4635', categoria: 'Fornecedor Bebidas', confidence: 0.90 },
  { cnaePrefix: '4637', categoria: 'Fornecedor Alimentos', confidence: 0.85 },
  { cnaePrefix: '4639', categoria: 'Fornecedor Alimentos', confidence: 0.80 },
  { cnaePrefix: '4646', categoria: 'Material Limpeza/Higiene', confidence: 0.85 },
  { cnaePrefix: '4691', categoria: 'Compras Mercadoria', confidence: 0.85 },
  { cnaePrefix: '4693', categoria: 'Compras Mercadoria', confidence: 0.80 },

  // Varejo alimentos (47.1x)
  { cnaePrefix: '4711', categoria: 'Compras Mercadoria', confidence: 0.85 },
  { cnaePrefix: '4712', categoria: 'Compras Mercadoria', confidence: 0.85 },
  { cnaePrefix: '4713', categoria: 'Compras Mercadoria', confidence: 0.85 },

  // Varejo vestuário (47.8x)
  { cnaePrefix: '4781', categoria: 'Compras Mercadoria', confidence: 0.85 },
  { cnaePrefix: '4782', categoria: 'Compras Mercadoria', confidence: 0.85 },
  { cnaePrefix: '4783', categoria: 'Compras Mercadoria', confidence: 0.85 },

  // Combustíveis (47.31/32)
  { cnaePrefix: '4731', categoria: 'Combustível', confidence: 0.95 },
  { cnaePrefix: '4732', categoria: 'Combustível', confidence: 0.95 },

  // Restaurantes/Alimentação (56.xx)
  { cnaePrefix: '5611', categoria: 'Refeições/Alimentação', confidence: 0.85 },
  { cnaePrefix: '5612', categoria: 'Refeições/Alimentação', confidence: 0.85 },
  { cnaePrefix: '5620', categoria: 'Refeições/Alimentação', confidence: 0.85 },

  // Energia/Água/Gás (35.xx + 36.xx)
  { cnaePrefix: '3511', categoria: 'Energia Elétrica', confidence: 0.95 },
  { cnaePrefix: '3513', categoria: 'Energia Elétrica', confidence: 0.95 },
  { cnaePrefix: '3520', categoria: 'Gás', confidence: 0.95 },
  { cnaePrefix: '36', categoria: 'Água e Esgoto', confidence: 0.95 },

  // Telecom (61.xx)
  { cnaePrefix: '6110', categoria: 'Telefonia e Internet', confidence: 0.95 },
  { cnaePrefix: '6120', categoria: 'Telefonia e Internet', confidence: 0.95 },
  { cnaePrefix: '6130', categoria: 'Telefonia e Internet', confidence: 0.95 },
  { cnaePrefix: '6190', categoria: 'Telefonia e Internet', confidence: 0.90 },

  // Financeiros
  { cnaePrefix: '6491', categoria: 'Tarifas Bancárias', confidence: 0.85 },
  { cnaePrefix: '6499', categoria: 'Serviços Financeiros', confidence: 0.80 },
  { cnaePrefix: '65', categoria: 'Seguros', confidence: 0.80 },

  // Transporte/Frete
  { cnaePrefix: '4912', categoria: 'Frete', confidence: 0.85 },
  { cnaePrefix: '4921', categoria: 'Transporte', confidence: 0.85 },
  { cnaePrefix: '4929', categoria: 'Transporte', confidence: 0.85 },
  { cnaePrefix: '4930', categoria: 'Frete', confidence: 0.90 },
  { cnaePrefix: '5310', categoria: 'Frete', confidence: 0.95 }, // Correios

  // Educação
  { cnaePrefix: '8511', categoria: 'Educação/Cursos', confidence: 0.90 },
  { cnaePrefix: '8512', categoria: 'Educação/Cursos', confidence: 0.90 },
  { cnaePrefix: '8513', categoria: 'Educação/Cursos', confidence: 0.90 },
  { cnaePrefix: '8520', categoria: 'Educação/Cursos', confidence: 0.90 },
  { cnaePrefix: '8550', categoria: 'Educação/Cursos', confidence: 0.85 },

  // Saúde
  { cnaePrefix: '8610', categoria: 'Saúde/Clínica', confidence: 0.90 },
  { cnaePrefix: '8630', categoria: 'Saúde/Clínica', confidence: 0.90 },
  { cnaePrefix: '8650', categoria: 'Saúde/Clínica', confidence: 0.85 },

  // Streaming/Mídia
  { cnaePrefix: '5912', categoria: 'Assinaturas/Streaming', confidence: 0.80 },
  { cnaePrefix: '5920', categoria: 'Assinaturas/Streaming', confidence: 0.80 },
  { cnaePrefix: '60', categoria: 'Assinaturas/Streaming', confidence: 0.80 },

  // Marketing/Publicidade
  { cnaePrefix: '7311', categoria: 'Marketing Digital', confidence: 0.85 },
  { cnaePrefix: '7312', categoria: 'Marketing Digital', confidence: 0.85 },
  { cnaePrefix: '7319', categoria: 'Marketing Digital', confidence: 0.80 },

  // Apoio/Serviços
  { cnaePrefix: '7710', categoria: 'Aluguel de Equipamentos', confidence: 0.85 },
  { cnaePrefix: '8211', categoria: 'Serviços Administrativos', confidence: 0.75 },

  // Imobiliário (68.xx)
  { cnaePrefix: '6810', categoria: 'Aluguel', confidence: 0.80 },
  { cnaePrefix: '6820', categoria: 'Aluguel', confidence: 0.85 },

  // Profissionais (69.xx)
  { cnaePrefix: '6911', categoria: 'Honorários Jurídicos', confidence: 0.95 },
  { cnaePrefix: '6920', categoria: 'Honorários Contábeis', confidence: 0.95 },

  // Hospedagem (55.xx)
  { cnaePrefix: '5510', categoria: 'Viagens/Hospedagem', confidence: 0.85 },

  // Construção (41/42/43)
  { cnaePrefix: '41', categoria: 'Obras e Reformas', confidence: 0.80 },
  { cnaePrefix: '42', categoria: 'Obras e Reformas', confidence: 0.80 },
  { cnaePrefix: '43', categoria: 'Obras e Reformas', confidence: 0.80 },

  // Setor público (84) → impostos
  { cnaePrefix: '84', categoria: 'Tributos Federais', confidence: 0.75 },

  // Esporte/Lazer
  { cnaePrefix: '93', categoria: 'Esporte e Lazer', confidence: 0.75 },
]

// Pre-sorted por length DESC pra match mais específico primeiro
const SORTED_MAP = [...CNAE_CATEGORY_MAP].sort(
  (a, b) => b.cnaePrefix.length - a.cnaePrefix.length,
)

export interface CnaeCategoryResult {
  categoria: string
  confidence: number
  matchedPrefix: string
}

/**
 * Mapeia CNAE (string 7 dígitos ou number) → categoria + confidence.
 * Retorna null se CNAE inválido ou nenhum prefix bate.
 */
export function inferirCategoriaContabilFromCNAE(
  cnaeRaw: string | number | null | undefined,
  tipo: 'DEBIT' | 'CREDIT',
): CnaeCategoryResult | null {
  if (cnaeRaw === null || cnaeRaw === undefined) return null
  const cnae = String(cnaeRaw).replace(/\D/g, '')
  if (cnae.length < 2) return null

  for (const m of SORTED_MAP) {
    if (cnae.startsWith(m.cnaePrefix)) {
      // Se categoria é claramente expense e tx é CREDIT (recebimento), ignora
      // (ex: "Honorários Contábeis" só faz sentido como despesa)
      // Por enquanto não filtramos — caller decide via tipoTransacao.
      void tipo
      return {
        categoria: m.categoria,
        confidence: m.confidence,
        matchedPrefix: m.cnaePrefix,
      }
    }
  }
  return null
}
