// Sprint 5.0.2.l — Padrões universais brasileiros de categorização bancária.
//
// Funcionam pra QUALQUER empresa — são padrões do mercado BR (DARF, FGTS,
// Stone, Celesc, Vivo, Uber, etc). Aplicados como Fase 4 do pipeline,
// DEPOIS das regras aprendidas da empresa (Fase 3) e ANTES do Claude AI
// (Fase 5).
//
// Estratégia:
//   - confidence ≥ 0.90 → AUTO categoriza no import e no recategorize bulk
//   - confidence 0.70-0.89 → categoriza no bulk retroativo (não no import,
//     pra evitar surpresa em transações cuja semântica depende do contexto
//     da empresa)
//
// Cada padrão mapeia pra:
//   - `categoryNameHint`: nome da categoria (resolvido via
//     resolveCategoryFromHint contra o plano de contas da empresa, que
//     inclui as categorias do sistema garantidas por
//     ensureAllSystemCategories)
//   - `dreGroup`: grupo do DRE Gerencial (fallback quando categoria por
//     nome não casa)
//
// IMPORTANTE: pra adicionar/remover padrões, NÃO mexer na ordem — a engine
// ordena por confidence desc + length desc internamente.

export type UniversalMatchType = 'STARTS_WITH' | 'CONTAINS' | 'EQUALS'

export type UniversalTxType = 'INCOME' | 'EXPENSE' | 'ANY'

export type UniversalDreGroup =
  | 'RECEITA_BRUTA'
  | 'DEDUCOES'
  | 'CUSTO_PRODUTO_VENDIDO'
  | 'DESPESAS_COMERCIAIS'
  | 'DESPESAS_ADMINISTRATIVAS'
  | 'DESPESAS_PESSOAL'
  | 'RECEITAS_FINANCEIRAS'
  | 'DESPESAS_FINANCEIRAS'
  | 'OUTRAS_RECEITAS'
  | 'OUTRAS_DESPESAS'
  | 'IMPOSTOS_SOBRE_LUCRO'
  | 'TRANSFERENCIA'

export interface UniversalPattern {
  matchType: UniversalMatchType
  /** Padrão case-sensitive APÓS uppercase da descrição (a engine força). */
  pattern: string
  /** Nome da categoria do sistema (criada por ensureAllSystemCategories). */
  categoryNameHint: string
  /** Grupo DRE — usado como fallback quando categoria por nome não casa. */
  dreGroup: UniversalDreGroup
  /** INCOME = só CREDIT, EXPENSE = só DEBIT, ANY = qualquer. */
  type: UniversalTxType
  /** 0.70-1.0. ≥0.95 = AUTO no import; 0.70-0.94 = só no bulk retroativo. */
  confidence: number
}

export const UNIVERSAL_PATTERNS_BR: UniversalPattern[] = [
  // ═══════════════════════════════════════════════════════════
  // RECEITAS — Cartões / Maquininhas
  // ═══════════════════════════════════════════════════════════
  { matchType: 'CONTAINS', pattern: 'PAGAMENTO STONE', categoryNameHint: 'Receita Cartão', dreGroup: 'RECEITA_BRUTA', type: 'INCOME', confidence: 0.95 },
  { matchType: 'CONTAINS', pattern: 'CRED STONE', categoryNameHint: 'Receita Cartão', dreGroup: 'RECEITA_BRUTA', type: 'INCOME', confidence: 0.95 },
  { matchType: 'CONTAINS', pattern: 'PAGAMENTO CIELO', categoryNameHint: 'Receita Cartão', dreGroup: 'RECEITA_BRUTA', type: 'INCOME', confidence: 0.95 },
  { matchType: 'CONTAINS', pattern: 'PAGAMENTO REDE', categoryNameHint: 'Receita Cartão', dreGroup: 'RECEITA_BRUTA', type: 'INCOME', confidence: 0.95 },
  { matchType: 'CONTAINS', pattern: 'PAGAMENTO GETNET', categoryNameHint: 'Receita Cartão', dreGroup: 'RECEITA_BRUTA', type: 'INCOME', confidence: 0.95 },
  { matchType: 'CONTAINS', pattern: 'PAGAMENTO PAGSEGURO', categoryNameHint: 'Receita Cartão', dreGroup: 'RECEITA_BRUTA', type: 'INCOME', confidence: 0.95 },
  { matchType: 'CONTAINS', pattern: 'CREDITO TEF', categoryNameHint: 'Receita Cartão', dreGroup: 'RECEITA_BRUTA', type: 'INCOME', confidence: 0.90 },
  { matchType: 'CONTAINS', pattern: 'CRÉDITO TEF', categoryNameHint: 'Receita Cartão', dreGroup: 'RECEITA_BRUTA', type: 'INCOME', confidence: 0.90 },
  { matchType: 'CONTAINS', pattern: 'LIQUIDACAO ADQUIRENTE', categoryNameHint: 'Receita Cartão', dreGroup: 'RECEITA_BRUTA', type: 'INCOME', confidence: 0.95 },
  { matchType: 'CONTAINS', pattern: 'LIQUIDAÇÃO ADQUIRENTE', categoryNameHint: 'Receita Cartão', dreGroup: 'RECEITA_BRUTA', type: 'INCOME', confidence: 0.95 },

  // ═══════════════════════════════════════════════════════════
  // RECEITAS — Pix / TED / Boleto (CONSERVADOR: confidence baixa)
  // Razão: Pix recebido pode ser Receita de Venda, Distribuição
  // de Lucros, Estorno, etc. Só sugerimos no bulk retroativo;
  // não AUTO no import.
  // ═══════════════════════════════════════════════════════════
  { matchType: 'STARTS_WITH', pattern: 'RECEBIMENTO PIX', categoryNameHint: 'Receita Pix', dreGroup: 'RECEITA_BRUTA', type: 'INCOME', confidence: 0.80 },
  { matchType: 'STARTS_WITH', pattern: 'TED RECEBIDA', categoryNameHint: 'Receita TED', dreGroup: 'RECEITA_BRUTA', type: 'INCOME', confidence: 0.85 },
  { matchType: 'STARTS_WITH', pattern: 'DOC RECEBIDO', categoryNameHint: 'Receita TED', dreGroup: 'RECEITA_BRUTA', type: 'INCOME', confidence: 0.85 },
  { matchType: 'CONTAINS', pattern: 'CREDITO TED', categoryNameHint: 'Receita TED', dreGroup: 'RECEITA_BRUTA', type: 'INCOME', confidence: 0.85 },
  { matchType: 'CONTAINS', pattern: 'CRÉDITO TED', categoryNameHint: 'Receita TED', dreGroup: 'RECEITA_BRUTA', type: 'INCOME', confidence: 0.85 },
  { matchType: 'CONTAINS', pattern: 'BOLETO RECEBIDO', categoryNameHint: 'Receita Boleto', dreGroup: 'RECEITA_BRUTA', type: 'INCOME', confidence: 0.85 },
  { matchType: 'CONTAINS', pattern: 'COBRANCA RECEBIDA', categoryNameHint: 'Receita Boleto', dreGroup: 'RECEITA_BRUTA', type: 'INCOME', confidence: 0.85 },
  { matchType: 'STARTS_WITH', pattern: 'CREDITO COBRANCA', categoryNameHint: 'Receita Boleto', dreGroup: 'RECEITA_BRUTA', type: 'INCOME', confidence: 0.90 },

  // ═══════════════════════════════════════════════════════════
  // DESPESAS — Tributárias federais (alta confidence)
  // ═══════════════════════════════════════════════════════════
  { matchType: 'CONTAINS', pattern: 'DAS SIMPLES', categoryNameHint: 'DAS Simples Nacional', dreGroup: 'IMPOSTOS_SOBRE_LUCRO', type: 'EXPENSE', confidence: 0.98 },
  { matchType: 'CONTAINS', pattern: 'DAS-MEI', categoryNameHint: 'DAS MEI', dreGroup: 'IMPOSTOS_SOBRE_LUCRO', type: 'EXPENSE', confidence: 0.98 },
  { matchType: 'CONTAINS', pattern: 'DAS MEI', categoryNameHint: 'DAS MEI', dreGroup: 'IMPOSTOS_SOBRE_LUCRO', type: 'EXPENSE', confidence: 0.98 },
  { matchType: 'CONTAINS', pattern: 'DARF', categoryNameHint: 'Tributos Federais', dreGroup: 'IMPOSTOS_SOBRE_LUCRO', type: 'EXPENSE', confidence: 0.95 },

  // Encargos trabalhistas
  { matchType: 'CONTAINS', pattern: 'GPS INSS', categoryNameHint: 'INSS', dreGroup: 'DESPESAS_PESSOAL', type: 'EXPENSE', confidence: 0.95 },
  { matchType: 'CONTAINS', pattern: 'INSS', categoryNameHint: 'INSS', dreGroup: 'DESPESAS_PESSOAL', type: 'EXPENSE', confidence: 0.95 },
  { matchType: 'CONTAINS', pattern: 'PREVIDENCIA SOCIAL', categoryNameHint: 'INSS', dreGroup: 'DESPESAS_PESSOAL', type: 'EXPENSE', confidence: 0.90 },
  { matchType: 'CONTAINS', pattern: 'FGTS', categoryNameHint: 'FGTS', dreGroup: 'DESPESAS_PESSOAL', type: 'EXPENSE', confidence: 0.95 },
  { matchType: 'CONTAINS', pattern: 'GRRF', categoryNameHint: 'FGTS', dreGroup: 'DESPESAS_PESSOAL', type: 'EXPENSE', confidence: 0.90 },

  // Impostos sobre venda (DEDUCOES no DRE)
  { matchType: 'CONTAINS', pattern: 'GUIA ICMS', categoryNameHint: 'ICMS', dreGroup: 'DEDUCOES', type: 'EXPENSE', confidence: 0.95 },
  { matchType: 'CONTAINS', pattern: 'ICMS NORMAL', categoryNameHint: 'ICMS', dreGroup: 'DEDUCOES', type: 'EXPENSE', confidence: 0.95 },
  { matchType: 'CONTAINS', pattern: 'ICMS ST', categoryNameHint: 'ICMS-ST', dreGroup: 'DEDUCOES', type: 'EXPENSE', confidence: 0.95 },
  { matchType: 'CONTAINS', pattern: 'GUIA ISS', categoryNameHint: 'ISS', dreGroup: 'DEDUCOES', type: 'EXPENSE', confidence: 0.95 },
  { matchType: 'CONTAINS', pattern: 'NFS-E', categoryNameHint: 'ISS', dreGroup: 'DEDUCOES', type: 'EXPENSE', confidence: 0.80 },

  // Tributos municipais sobre patrimônio
  { matchType: 'CONTAINS', pattern: 'IPTU', categoryNameHint: 'IPTU', dreGroup: 'DESPESAS_ADMINISTRATIVAS', type: 'EXPENSE', confidence: 0.95 },
  { matchType: 'CONTAINS', pattern: 'IPVA', categoryNameHint: 'IPVA', dreGroup: 'DESPESAS_ADMINISTRATIVAS', type: 'EXPENSE', confidence: 0.95 },

  // ═══════════════════════════════════════════════════════════
  // DESPESAS — Bancárias
  // ═══════════════════════════════════════════════════════════
  { matchType: 'STARTS_WITH', pattern: 'TARIFA', categoryNameHint: 'Tarifas Bancárias', dreGroup: 'DESPESAS_FINANCEIRAS', type: 'EXPENSE', confidence: 0.92 },
  { matchType: 'CONTAINS', pattern: 'MANUTENCAO CONTA', categoryNameHint: 'Tarifas Bancárias', dreGroup: 'DESPESAS_FINANCEIRAS', type: 'EXPENSE', confidence: 0.95 },
  { matchType: 'CONTAINS', pattern: 'MANUTENÇÃO CONTA', categoryNameHint: 'Tarifas Bancárias', dreGroup: 'DESPESAS_FINANCEIRAS', type: 'EXPENSE', confidence: 0.95 },
  { matchType: 'CONTAINS', pattern: 'PACOTE TARIFA', categoryNameHint: 'Tarifas Bancárias', dreGroup: 'DESPESAS_FINANCEIRAS', type: 'EXPENSE', confidence: 0.95 },
  { matchType: 'CONTAINS', pattern: 'TARIFA PIX', categoryNameHint: 'Tarifas Bancárias', dreGroup: 'DESPESAS_FINANCEIRAS', type: 'EXPENSE', confidence: 0.95 },
  { matchType: 'CONTAINS', pattern: 'TARIFA TED', categoryNameHint: 'Tarifas Bancárias', dreGroup: 'DESPESAS_FINANCEIRAS', type: 'EXPENSE', confidence: 0.95 },
  { matchType: 'CONTAINS', pattern: 'TARIFA BOLETO', categoryNameHint: 'Tarifas Bancárias', dreGroup: 'DESPESAS_FINANCEIRAS', type: 'EXPENSE', confidence: 0.95 },
  { matchType: 'CONTAINS', pattern: 'IOF', categoryNameHint: 'Tarifas Bancárias', dreGroup: 'DESPESAS_FINANCEIRAS', type: 'EXPENSE', confidence: 0.90 },

  // Juros / encargos
  { matchType: 'CONTAINS', pattern: 'CHEQUE ESPECIAL', categoryNameHint: 'Juros e Encargos', dreGroup: 'DESPESAS_FINANCEIRAS', type: 'EXPENSE', confidence: 0.92 },
  { matchType: 'CONTAINS', pattern: 'CRED ROTATIVO', categoryNameHint: 'Juros e Encargos', dreGroup: 'DESPESAS_FINANCEIRAS', type: 'EXPENSE', confidence: 0.92 },
  { matchType: 'CONTAINS', pattern: 'JUROS CONTRATO', categoryNameHint: 'Juros e Encargos', dreGroup: 'DESPESAS_FINANCEIRAS', type: 'EXPENSE', confidence: 0.92 },

  // Taxa cartão (despesa)
  { matchType: 'CONTAINS', pattern: 'TARIFA STONE', categoryNameHint: 'Taxa Cartão', dreGroup: 'DESPESAS_FINANCEIRAS', type: 'EXPENSE', confidence: 0.95 },
  { matchType: 'CONTAINS', pattern: 'TARIFA CIELO', categoryNameHint: 'Taxa Cartão', dreGroup: 'DESPESAS_FINANCEIRAS', type: 'EXPENSE', confidence: 0.95 },
  { matchType: 'CONTAINS', pattern: 'TARIFA REDE', categoryNameHint: 'Taxa Cartão', dreGroup: 'DESPESAS_FINANCEIRAS', type: 'EXPENSE', confidence: 0.95 },
  { matchType: 'CONTAINS', pattern: 'COMISSAO STONE', categoryNameHint: 'Taxa Cartão', dreGroup: 'DESPESAS_FINANCEIRAS', type: 'EXPENSE', confidence: 0.95 },
  { matchType: 'CONTAINS', pattern: 'COMISSÃO STONE', categoryNameHint: 'Taxa Cartão', dreGroup: 'DESPESAS_FINANCEIRAS', type: 'EXPENSE', confidence: 0.95 },

  // ═══════════════════════════════════════════════════════════
  // DESPESAS — Utilidades (concessionárias por estado)
  // ═══════════════════════════════════════════════════════════
  { matchType: 'CONTAINS', pattern: 'CELESC', categoryNameHint: 'Energia Elétrica', dreGroup: 'DESPESAS_ADMINISTRATIVAS', type: 'EXPENSE', confidence: 0.95 },
  { matchType: 'CONTAINS', pattern: 'CPFL', categoryNameHint: 'Energia Elétrica', dreGroup: 'DESPESAS_ADMINISTRATIVAS', type: 'EXPENSE', confidence: 0.95 },
  { matchType: 'CONTAINS', pattern: 'ENEL', categoryNameHint: 'Energia Elétrica', dreGroup: 'DESPESAS_ADMINISTRATIVAS', type: 'EXPENSE', confidence: 0.95 },
  { matchType: 'CONTAINS', pattern: 'COELBA', categoryNameHint: 'Energia Elétrica', dreGroup: 'DESPESAS_ADMINISTRATIVAS', type: 'EXPENSE', confidence: 0.95 },
  { matchType: 'CONTAINS', pattern: 'ELEKTRO', categoryNameHint: 'Energia Elétrica', dreGroup: 'DESPESAS_ADMINISTRATIVAS', type: 'EXPENSE', confidence: 0.95 },
  { matchType: 'CONTAINS', pattern: 'ENERGISA', categoryNameHint: 'Energia Elétrica', dreGroup: 'DESPESAS_ADMINISTRATIVAS', type: 'EXPENSE', confidence: 0.95 },
  { matchType: 'CONTAINS', pattern: 'EQUATORIAL', categoryNameHint: 'Energia Elétrica', dreGroup: 'DESPESAS_ADMINISTRATIVAS', type: 'EXPENSE', confidence: 0.95 },
  { matchType: 'CONTAINS', pattern: 'COPEL', categoryNameHint: 'Energia Elétrica', dreGroup: 'DESPESAS_ADMINISTRATIVAS', type: 'EXPENSE', confidence: 0.95 },
  { matchType: 'CONTAINS', pattern: 'CEMIG', categoryNameHint: 'Energia Elétrica', dreGroup: 'DESPESAS_ADMINISTRATIVAS', type: 'EXPENSE', confidence: 0.95 },
  { matchType: 'CONTAINS', pattern: 'LIGHT ', categoryNameHint: 'Energia Elétrica', dreGroup: 'DESPESAS_ADMINISTRATIVAS', type: 'EXPENSE', confidence: 0.80 },

  // Água
  { matchType: 'CONTAINS', pattern: 'CASAN', categoryNameHint: 'Água e Esgoto', dreGroup: 'DESPESAS_ADMINISTRATIVAS', type: 'EXPENSE', confidence: 0.95 },
  { matchType: 'CONTAINS', pattern: 'SABESP', categoryNameHint: 'Água e Esgoto', dreGroup: 'DESPESAS_ADMINISTRATIVAS', type: 'EXPENSE', confidence: 0.95 },
  { matchType: 'CONTAINS', pattern: 'CEDAE', categoryNameHint: 'Água e Esgoto', dreGroup: 'DESPESAS_ADMINISTRATIVAS', type: 'EXPENSE', confidence: 0.95 },
  { matchType: 'CONTAINS', pattern: 'COPASA', categoryNameHint: 'Água e Esgoto', dreGroup: 'DESPESAS_ADMINISTRATIVAS', type: 'EXPENSE', confidence: 0.95 },
  { matchType: 'CONTAINS', pattern: 'CORSAN', categoryNameHint: 'Água e Esgoto', dreGroup: 'DESPESAS_ADMINISTRATIVAS', type: 'EXPENSE', confidence: 0.95 },

  // Telefonia / internet
  { matchType: 'CONTAINS', pattern: 'VIVO ', categoryNameHint: 'Telefonia e Internet', dreGroup: 'DESPESAS_ADMINISTRATIVAS', type: 'EXPENSE', confidence: 0.85 },
  { matchType: 'CONTAINS', pattern: 'TIM ', categoryNameHint: 'Telefonia e Internet', dreGroup: 'DESPESAS_ADMINISTRATIVAS', type: 'EXPENSE', confidence: 0.85 },
  { matchType: 'CONTAINS', pattern: 'CLARO ', categoryNameHint: 'Telefonia e Internet', dreGroup: 'DESPESAS_ADMINISTRATIVAS', type: 'EXPENSE', confidence: 0.85 },
  { matchType: 'CONTAINS', pattern: 'OI MOVEL', categoryNameHint: 'Telefonia e Internet', dreGroup: 'DESPESAS_ADMINISTRATIVAS', type: 'EXPENSE', confidence: 0.90 },
  { matchType: 'CONTAINS', pattern: 'NEXTEL', categoryNameHint: 'Telefonia e Internet', dreGroup: 'DESPESAS_ADMINISTRATIVAS', type: 'EXPENSE', confidence: 0.95 },

  // Gás
  { matchType: 'CONTAINS', pattern: 'COMGAS', categoryNameHint: 'Gás', dreGroup: 'DESPESAS_ADMINISTRATIVAS', type: 'EXPENSE', confidence: 0.95 },
  { matchType: 'CONTAINS', pattern: 'SCGAS', categoryNameHint: 'Gás', dreGroup: 'DESPESAS_ADMINISTRATIVAS', type: 'EXPENSE', confidence: 0.95 },

  // ═══════════════════════════════════════════════════════════
  // DESPESAS — Folha
  // ═══════════════════════════════════════════════════════════
  { matchType: 'CONTAINS', pattern: 'FOLHA PAGAMENTO', categoryNameHint: 'Salários', dreGroup: 'DESPESAS_PESSOAL', type: 'EXPENSE', confidence: 0.95 },
  { matchType: 'CONTAINS', pattern: 'PAGAMENTO SALARIO', categoryNameHint: 'Salários', dreGroup: 'DESPESAS_PESSOAL', type: 'EXPENSE', confidence: 0.95 },
  { matchType: 'CONTAINS', pattern: 'PAGAMENTO SALÁRIO', categoryNameHint: 'Salários', dreGroup: 'DESPESAS_PESSOAL', type: 'EXPENSE', confidence: 0.95 },
  { matchType: 'CONTAINS', pattern: 'PAGAMENTO FUNCIONARIO', categoryNameHint: 'Salários', dreGroup: 'DESPESAS_PESSOAL', type: 'EXPENSE', confidence: 0.90 },
  { matchType: 'CONTAINS', pattern: 'VALE TRANSPORTE', categoryNameHint: 'Vale Transporte', dreGroup: 'DESPESAS_PESSOAL', type: 'EXPENSE', confidence: 0.95 },
  { matchType: 'CONTAINS', pattern: 'VALE ALIMENTACAO', categoryNameHint: 'Vale Alimentação', dreGroup: 'DESPESAS_PESSOAL', type: 'EXPENSE', confidence: 0.95 },
  { matchType: 'CONTAINS', pattern: 'VALE ALIMENTAÇÃO', categoryNameHint: 'Vale Alimentação', dreGroup: 'DESPESAS_PESSOAL', type: 'EXPENSE', confidence: 0.95 },
  { matchType: 'CONTAINS', pattern: 'VALE REFEICAO', categoryNameHint: 'Vale Refeição', dreGroup: 'DESPESAS_PESSOAL', type: 'EXPENSE', confidence: 0.95 },
  { matchType: 'CONTAINS', pattern: 'VALE REFEIÇÃO', categoryNameHint: 'Vale Refeição', dreGroup: 'DESPESAS_PESSOAL', type: 'EXPENSE', confidence: 0.95 },
  { matchType: 'CONTAINS', pattern: 'TICKET LOG', categoryNameHint: 'Vale Alimentação', dreGroup: 'DESPESAS_PESSOAL', type: 'EXPENSE', confidence: 0.90 },

  // ═══════════════════════════════════════════════════════════
  // DESPESAS — Operacionais
  // ═══════════════════════════════════════════════════════════
  { matchType: 'CONTAINS', pattern: 'ALUGUEL', categoryNameHint: 'Aluguel', dreGroup: 'DESPESAS_ADMINISTRATIVAS', type: 'EXPENSE', confidence: 0.90 },
  { matchType: 'CONTAINS', pattern: 'CONDOMINIO', categoryNameHint: 'Condomínio', dreGroup: 'DESPESAS_ADMINISTRATIVAS', type: 'EXPENSE', confidence: 0.90 },
  { matchType: 'CONTAINS', pattern: 'CONDOMÍNIO', categoryNameHint: 'Condomínio', dreGroup: 'DESPESAS_ADMINISTRATIVAS', type: 'EXPENSE', confidence: 0.90 },

  // Combustíveis
  { matchType: 'CONTAINS', pattern: 'POSTO ', categoryNameHint: 'Combustível', dreGroup: 'DESPESAS_ADMINISTRATIVAS', type: 'EXPENSE', confidence: 0.85 },
  { matchType: 'CONTAINS', pattern: 'COMBUSTIVEL', categoryNameHint: 'Combustível', dreGroup: 'DESPESAS_ADMINISTRATIVAS', type: 'EXPENSE', confidence: 0.90 },
  { matchType: 'CONTAINS', pattern: 'COMBUSTÍVEL', categoryNameHint: 'Combustível', dreGroup: 'DESPESAS_ADMINISTRATIVAS', type: 'EXPENSE', confidence: 0.90 },
  { matchType: 'CONTAINS', pattern: 'SHELL', categoryNameHint: 'Combustível', dreGroup: 'DESPESAS_ADMINISTRATIVAS', type: 'EXPENSE', confidence: 0.85 },
  { matchType: 'CONTAINS', pattern: 'IPIRANGA', categoryNameHint: 'Combustível', dreGroup: 'DESPESAS_ADMINISTRATIVAS', type: 'EXPENSE', confidence: 0.85 },
  { matchType: 'CONTAINS', pattern: 'PETROBRAS', categoryNameHint: 'Combustível', dreGroup: 'DESPESAS_ADMINISTRATIVAS', type: 'EXPENSE', confidence: 0.85 },

  // ═══════════════════════════════════════════════════════════
  // DESPESAS — Transporte / Delivery
  // ═══════════════════════════════════════════════════════════
  { matchType: 'CONTAINS', pattern: 'UBER ', categoryNameHint: 'Transporte (Uber)', dreGroup: 'DESPESAS_ADMINISTRATIVAS', type: 'EXPENSE', confidence: 0.95 },
  { matchType: 'CONTAINS', pattern: 'UBER*', categoryNameHint: 'Transporte (Uber)', dreGroup: 'DESPESAS_ADMINISTRATIVAS', type: 'EXPENSE', confidence: 0.95 },
  { matchType: 'CONTAINS', pattern: '99 APP', categoryNameHint: 'Transporte (99)', dreGroup: 'DESPESAS_ADMINISTRATIVAS', type: 'EXPENSE', confidence: 0.95 },
  { matchType: 'CONTAINS', pattern: 'IFOOD', categoryNameHint: 'Alimentação', dreGroup: 'DESPESAS_ADMINISTRATIVAS', type: 'EXPENSE', confidence: 0.95 },
  { matchType: 'CONTAINS', pattern: 'IFD*', categoryNameHint: 'Alimentação', dreGroup: 'DESPESAS_ADMINISTRATIVAS', type: 'EXPENSE', confidence: 0.90 },
  { matchType: 'CONTAINS', pattern: 'RAPPI', categoryNameHint: 'Alimentação', dreGroup: 'DESPESAS_ADMINISTRATIVAS', type: 'EXPENSE', confidence: 0.95 },
  { matchType: 'CONTAINS', pattern: 'UBER EATS', categoryNameHint: 'Alimentação', dreGroup: 'DESPESAS_ADMINISTRATIVAS', type: 'EXPENSE', confidence: 0.95 },

  // ═══════════════════════════════════════════════════════════
  // DESPESAS — Assinaturas / software
  // ═══════════════════════════════════════════════════════════
  { matchType: 'CONTAINS', pattern: 'NETFLIX', categoryNameHint: 'Assinaturas', dreGroup: 'DESPESAS_ADMINISTRATIVAS', type: 'EXPENSE', confidence: 0.95 },
  { matchType: 'CONTAINS', pattern: 'SPOTIFY', categoryNameHint: 'Assinaturas', dreGroup: 'DESPESAS_ADMINISTRATIVAS', type: 'EXPENSE', confidence: 0.95 },
  { matchType: 'CONTAINS', pattern: 'AMAZON AWS', categoryNameHint: 'Software/Tecnologia', dreGroup: 'DESPESAS_ADMINISTRATIVAS', type: 'EXPENSE', confidence: 0.95 },
  { matchType: 'CONTAINS', pattern: 'GOOGLE WORKSPACE', categoryNameHint: 'Software/Tecnologia', dreGroup: 'DESPESAS_ADMINISTRATIVAS', type: 'EXPENSE', confidence: 0.95 },
  { matchType: 'CONTAINS', pattern: 'GOOGLE CLOUD', categoryNameHint: 'Software/Tecnologia', dreGroup: 'DESPESAS_ADMINISTRATIVAS', type: 'EXPENSE', confidence: 0.95 },
  { matchType: 'CONTAINS', pattern: 'MICROSOFT', categoryNameHint: 'Software/Tecnologia', dreGroup: 'DESPESAS_ADMINISTRATIVAS', type: 'EXPENSE', confidence: 0.85 },
  { matchType: 'CONTAINS', pattern: 'AMZN MKTP', categoryNameHint: 'Compras', dreGroup: 'DESPESAS_ADMINISTRATIVAS', type: 'EXPENSE', confidence: 0.90 },

  // ═══════════════════════════════════════════════════════════
  // ESTORNOS / DEVOLUÇÕES (any type)
  // ═══════════════════════════════════════════════════════════
  { matchType: 'CONTAINS', pattern: 'ESTORNO', categoryNameHint: 'Estornos', dreGroup: 'OUTRAS_RECEITAS', type: 'ANY', confidence: 0.85 },
  { matchType: 'CONTAINS', pattern: 'DEVOLUCAO', categoryNameHint: 'Estornos', dreGroup: 'OUTRAS_RECEITAS', type: 'ANY', confidence: 0.85 },
  { matchType: 'CONTAINS', pattern: 'DEVOLUÇÃO', categoryNameHint: 'Estornos', dreGroup: 'OUTRAS_RECEITAS', type: 'ANY', confidence: 0.85 },
]

/**
 * Conjunto único de categoryNameHint × dreGroup × type ALL.
 * Usado por ensureAllSystemCategories pra criar exatamente as categorias
 * referenciadas pelos padrões (idempotente).
 */
export const UNIVERSAL_PATTERN_CATEGORIES: Array<{
  name: string
  dreGroup: UniversalDreGroup
  /** Sempre EXPENSE pra DESPESAS_*, INCOME/TRANSFER pra RECEITA/TRANSFERENCIA. Derivado do dreGroup. */
  txType: 'INCOME' | 'EXPENSE' | 'TRANSFER'
}> = (() => {
  const map = new Map<
    string,
    { name: string; dreGroup: UniversalDreGroup; txType: 'INCOME' | 'EXPENSE' | 'TRANSFER' }
  >()
  for (const p of UNIVERSAL_PATTERNS_BR) {
    const key = `${p.categoryNameHint}|${p.dreGroup}`
    if (map.has(key)) continue
    const txType: 'INCOME' | 'EXPENSE' | 'TRANSFER' =
      p.dreGroup === 'RECEITA_BRUTA' ||
      p.dreGroup === 'RECEITAS_FINANCEIRAS' ||
      p.dreGroup === 'OUTRAS_RECEITAS'
        ? 'INCOME'
        : p.dreGroup === 'TRANSFERENCIA'
          ? 'TRANSFER'
          : 'EXPENSE'
    map.set(key, { name: p.categoryNameHint, dreGroup: p.dreGroup, txType })
  }
  return Array.from(map.values())
})()
