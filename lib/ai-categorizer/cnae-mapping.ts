// Mapeamento CNAE → categoria DRE — Fase 3 Etapa 2.
// FUNÇÃO PURA: sem deps, testável.
//
// CNAE (Classificação Nacional de Atividades Econômicas) é o código de 7
// dígitos (formato "12.345-67/89") atribuído pela Receita Federal a cada
// empresa, indicando seu setor.
//
// A BrasilAPI retorna `cnae_fiscal` numérico (7 dígitos sem separadores).
// Mapeamos pelo prefixo (2 dígitos = divisão; 4 = classe) → sugestão de
// categoria DRE. Não mapeado → null (deixa Camada 3 ou manual classificar).

import type { DreGroupHint } from './keyword-detector'

export interface CnaeHint {
  dreGroup: DreGroupHint
  categoryNameHint: string
  // Descrição amigável do setor pra exibir no badge BrasilAPI
  setor: string
}

// Tabela por PREFIXO do CNAE.
// Ordem importa: prefixo mais ESPECÍFICO primeiro (3-4 dígitos)
// antes do mais GERAL (2 dígitos). Lookup faz match do mais específico
// que casa.
//
// Fonte: Comissão Nacional de Classificação (CONCLA) — Receita Federal.
// Foco: setores mais comuns em transações bancárias de PMEs BR.
const CNAE_MAP: Record<string, CnaeHint> = {
  // ============ DIVISÃO ESPECÍFICA ============

  // Combustível varejo (47.31)
  '4731': { dreGroup: 'DESPESAS_ADMINISTRATIVAS', categoryNameHint: 'Combustível', setor: 'Combustíveis' },

  // ============ DIVISÕES (2 dígitos) ============

  // 10-12: Alimentos / Bebidas / Tabaco → Custos Variáveis (insumos)
  '10': { dreGroup: 'CUSTOS_VARIAVEIS', categoryNameHint: 'Alimentos e Bebidas', setor: 'Alimentos' },
  '11': { dreGroup: 'CUSTOS_VARIAVEIS', categoryNameHint: 'Alimentos e Bebidas', setor: 'Bebidas' },

  // 35: Energia elétrica
  '35': { dreGroup: 'DESPESAS_ADMINISTRATIVAS', categoryNameHint: 'Energia Elétrica', setor: 'Energia Elétrica' },

  // 36-37: Água e saneamento
  '36': { dreGroup: 'DESPESAS_ADMINISTRATIVAS', categoryNameHint: 'Água', setor: 'Saneamento' },
  '37': { dreGroup: 'DESPESAS_ADMINISTRATIVAS', categoryNameHint: 'Água', setor: 'Saneamento' },

  // 41-43: Construção
  '41': { dreGroup: 'DESPESAS_OPERACIONAIS', categoryNameHint: 'Obras e Reformas', setor: 'Construção' },
  '42': { dreGroup: 'DESPESAS_OPERACIONAIS', categoryNameHint: 'Obras e Reformas', setor: 'Construção' },
  '43': { dreGroup: 'DESPESAS_OPERACIONAIS', categoryNameHint: 'Obras e Reformas', setor: 'Construção' },

  // 47: Comércio varejista (genérico — fornecedores)
  '47': { dreGroup: 'CUSTOS_VARIAVEIS', categoryNameHint: 'Fornecedores', setor: 'Comércio Varejista' },

  // 49-52: Transporte e logística
  '49': { dreGroup: 'DESPESAS_OPERACIONAIS', categoryNameHint: 'Transporte', setor: 'Transporte' },
  '50': { dreGroup: 'DESPESAS_OPERACIONAIS', categoryNameHint: 'Transporte', setor: 'Transporte' },
  '51': { dreGroup: 'DESPESAS_OPERACIONAIS', categoryNameHint: 'Transporte', setor: 'Transporte Aéreo' },
  '52': { dreGroup: 'DESPESAS_OPERACIONAIS', categoryNameHint: 'Logística', setor: 'Logística' },

  // 55-56: Hospedagem / Alimentação fora
  '55': { dreGroup: 'DESPESAS_OPERACIONAIS', categoryNameHint: 'Viagens', setor: 'Hospedagem' },
  '56': { dreGroup: 'DESPESAS_OPERACIONAIS', categoryNameHint: 'Alimentação', setor: 'Restaurantes' },

  // 58-63: Tecnologia / Informação
  '58': { dreGroup: 'DESPESAS_ADMINISTRATIVAS', categoryNameHint: 'Software/Assinaturas', setor: 'Edição/Software' },
  '61': { dreGroup: 'DESPESAS_ADMINISTRATIVAS', categoryNameHint: 'Telefonia', setor: 'Telecomunicações' },
  '62': { dreGroup: 'DESPESAS_ADMINISTRATIVAS', categoryNameHint: 'Software/Assinaturas', setor: 'Software / TI' },
  '63': { dreGroup: 'DESPESAS_ADMINISTRATIVAS', categoryNameHint: 'Software/Assinaturas', setor: 'Hospedagem de Dados' },

  // 64-66: Serviços financeiros
  '64': { dreGroup: 'DESPESAS_FINANCEIRAS', categoryNameHint: 'Tarifas Bancárias', setor: 'Instituição Financeira' },
  '65': { dreGroup: 'DESPESAS_FINANCEIRAS', categoryNameHint: 'Seguros', setor: 'Seguros' },
  '66': { dreGroup: 'DESPESAS_FINANCEIRAS', categoryNameHint: 'Tarifas Bancárias', setor: 'Atividades Financeiras Auxiliares' },

  // 68: Atividades imobiliárias
  '68': { dreGroup: 'DESPESAS_ADMINISTRATIVAS', categoryNameHint: 'Aluguel', setor: 'Imóveis' },

  // 69-75: Serviços profissionais
  '69': { dreGroup: 'DESPESAS_ADMINISTRATIVAS', categoryNameHint: 'Honorários Profissionais', setor: 'Contabilidade/Advocacia' },
  '70': { dreGroup: 'DESPESAS_ADMINISTRATIVAS', categoryNameHint: 'Consultoria', setor: 'Consultoria' },
  '71': { dreGroup: 'DESPESAS_ADMINISTRATIVAS', categoryNameHint: 'Engenharia', setor: 'Arquitetura/Engenharia' },
  '72': { dreGroup: 'DESPESAS_ADMINISTRATIVAS', categoryNameHint: 'Pesquisa', setor: 'P&D' },
  '73': { dreGroup: 'DESPESAS_COMERCIAIS', categoryNameHint: 'Marketing', setor: 'Publicidade' },
  '74': { dreGroup: 'DESPESAS_ADMINISTRATIVAS', categoryNameHint: 'Outros Serviços Profissionais', setor: 'Outros Profissionais' },

  // 84: Administração pública / impostos
  '84': { dreGroup: 'DEDUCOES', categoryNameHint: 'Impostos e Taxas', setor: 'Setor Público' },

  // 85: Educação
  '85': { dreGroup: 'DESPESAS_OPERACIONAIS', categoryNameHint: 'Treinamento', setor: 'Educação' },

  // 86-88: Saúde
  '86': { dreGroup: 'DESPESAS_ADMINISTRATIVAS', categoryNameHint: 'Plano de Saúde', setor: 'Saúde' },
  '87': { dreGroup: 'DESPESAS_ADMINISTRATIVAS', categoryNameHint: 'Plano de Saúde', setor: 'Saúde' },
  '88': { dreGroup: 'DESPESAS_ADMINISTRATIVAS', categoryNameHint: 'Plano de Saúde', setor: 'Saúde' },

  // 93: Esporte / lazer
  '93': { dreGroup: 'DESPESAS_OPERACIONAIS', categoryNameHint: 'Esporte e Lazer', setor: 'Esporte' },
}

// Lookup ordenado: tenta prefixos do mais longo (4) pro mais curto (2).
// Aceita CNAE como string ou number; normaliza pra string de 7 dígitos.
export function mapCNAEtoCategoryHint(
  cnaeRaw: string | number | null | undefined,
): CnaeHint | null {
  if (cnaeRaw === null || cnaeRaw === undefined) return null

  const cnaeStr = String(cnaeRaw).replace(/\D/g, '')
  if (cnaeStr.length < 2) return null

  // BrasilAPI retorna CNAE em formato "DDCCS" (5-7 dígitos):
  //   - 2 primeiros = divisão (10-99)
  //   - 4 primeiros = grupo+classe específica
  // NÃO usamos padStart: a string original já tem os dígitos certos no INÍCIO.
  // Tenta prefixos de 4, 3, 2 dígitos (mais específico primeiro).
  for (const len of [4, 3, 2]) {
    if (cnaeStr.length < len) continue
    const prefix = cnaeStr.substring(0, len)
    const hint = CNAE_MAP[prefix]
    if (hint) return hint
  }

  return null
}

export const CNAE_MAP_KEYS: ReadonlyArray<string> = Object.keys(CNAE_MAP)
