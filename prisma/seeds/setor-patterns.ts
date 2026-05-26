// Sprint 5.0.2.l — Knowledge Base setorial CURATED.
//
// ~150 padrões em 5 setores:
//   - UNIVERSAL: aplicam pra todas as empresas (~70)
//   - RESTAURANTE: ~25
//   - ACADEMIA: ~15
//   - COMERCIO_ROUPA: ~15
//   - VAREJO_GERAL: ~5
//
// Pra rodar: `npx tsx prisma/seeds/setor-patterns.ts`
// Idempotente: usa upsert via (setor, matchType, pattern) como chave natural.

export type SetorEnum =
  | 'UNIVERSAL'
  | 'RESTAURANTE'
  | 'ACADEMIA'
  | 'COMERCIO_ROUPA'
  | 'VAREJO_GERAL'

export interface SetorPatternSeed {
  setor: SetorEnum
  matchType: 'STARTS_WITH' | 'CONTAINS' | 'EQUALS'
  pattern: string
  categoryName: string
  type: 'INCOME' | 'EXPENSE' | 'ANY'
  confidence: number
  description?: string
}

export const SETOR_PATTERNS_SEED: SetorPatternSeed[] = [
  // ═══════════════════════════════════════════════════════════════
  // UNIVERSAL — Tributos Federais
  // ═══════════════════════════════════════════════════════════════
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'DARF', categoryName: 'Tributos Federais', type: 'EXPENSE', confidence: 0.98 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'DAS SIMPLES', categoryName: 'DAS Simples Nacional', type: 'EXPENSE', confidence: 0.99 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'PAG DAS', categoryName: 'DAS Simples Nacional', type: 'EXPENSE', confidence: 0.98 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'DAS-MEI', categoryName: 'DAS MEI', type: 'EXPENSE', confidence: 0.99 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'GPS', categoryName: 'INSS', type: 'EXPENSE', confidence: 0.85 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'INSS', categoryName: 'INSS', type: 'EXPENSE', confidence: 0.95 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'FGTS', categoryName: 'FGTS', type: 'EXPENSE', confidence: 0.95 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'GRRF', categoryName: 'FGTS', type: 'EXPENSE', confidence: 0.90 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'GUIA ICMS', categoryName: 'ICMS', type: 'EXPENSE', confidence: 0.95 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'ICMS NORMAL', categoryName: 'ICMS', type: 'EXPENSE', confidence: 0.95 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'ICMS ST', categoryName: 'ICMS-ST', type: 'EXPENSE', confidence: 0.95 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'NFS-E', categoryName: 'ISS', type: 'EXPENSE', confidence: 0.85 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'GUIA ISS', categoryName: 'ISS', type: 'EXPENSE', confidence: 0.95 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'IPTU', categoryName: 'IPTU', type: 'EXPENSE', confidence: 0.95 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'IPVA', categoryName: 'IPVA', type: 'EXPENSE', confidence: 0.95 },

  // ═══════════════════════════════════════════════════════════════
  // UNIVERSAL — Tarifas Bancárias BR
  // ═══════════════════════════════════════════════════════════════
  { setor: 'UNIVERSAL', matchType: 'STARTS_WITH', pattern: 'TARIFA', categoryName: 'Tarifas Bancárias', type: 'EXPENSE', confidence: 0.92 },
  { setor: 'UNIVERSAL', matchType: 'STARTS_WITH', pattern: 'TAR PCT', categoryName: 'Tarifas Bancárias', type: 'EXPENSE', confidence: 0.95 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'MENSALIDADE CESTA', categoryName: 'Tarifas Bancárias', type: 'EXPENSE', confidence: 0.95 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'MANUTENCAO CC', categoryName: 'Tarifas Bancárias', type: 'EXPENSE', confidence: 0.95 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'PACOTE TARIFA', categoryName: 'Tarifas Bancárias', type: 'EXPENSE', confidence: 0.95 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'IOF', categoryName: 'Tarifas Bancárias', type: 'EXPENSE', confidence: 0.85 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'JUROS', categoryName: 'Juros e Encargos', type: 'EXPENSE', confidence: 0.85 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'CHEQUE ESPECIAL', categoryName: 'Juros e Encargos', type: 'EXPENSE', confidence: 0.90 },

  // ═══════════════════════════════════════════════════════════════
  // UNIVERSAL — Pix / TED / Boleto genéricos
  // ═══════════════════════════════════════════════════════════════
  { setor: 'UNIVERSAL', matchType: 'STARTS_WITH', pattern: 'TED RECEBIDA', categoryName: 'Receita TED', type: 'INCOME', confidence: 0.80 },
  { setor: 'UNIVERSAL', matchType: 'STARTS_WITH', pattern: 'DOC RECEBIDO', categoryName: 'Receita TED', type: 'INCOME', confidence: 0.80 },
  { setor: 'UNIVERSAL', matchType: 'STARTS_WITH', pattern: 'CREDITO COBRANCA', categoryName: 'Receita Boleto', type: 'INCOME', confidence: 0.85 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'COBRANCA RECEBIDA', categoryName: 'Receita Boleto', type: 'INCOME', confidence: 0.85 },

  // ═══════════════════════════════════════════════════════════════
  // UNIVERSAL — Utilidades BR (Energia)
  // ═══════════════════════════════════════════════════════════════
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'CELESC', categoryName: 'Energia Elétrica', type: 'EXPENSE', confidence: 0.98 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'CPFL', categoryName: 'Energia Elétrica', type: 'EXPENSE', confidence: 0.98 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'ENEL', categoryName: 'Energia Elétrica', type: 'EXPENSE', confidence: 0.98 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'COELBA', categoryName: 'Energia Elétrica', type: 'EXPENSE', confidence: 0.98 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'ELEKTRO', categoryName: 'Energia Elétrica', type: 'EXPENSE', confidence: 0.98 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'ENERGISA', categoryName: 'Energia Elétrica', type: 'EXPENSE', confidence: 0.98 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'EQUATORIAL', categoryName: 'Energia Elétrica', type: 'EXPENSE', confidence: 0.98 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'COPEL', categoryName: 'Energia Elétrica', type: 'EXPENSE', confidence: 0.98 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'CEMIG', categoryName: 'Energia Elétrica', type: 'EXPENSE', confidence: 0.98 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'LIGHT', categoryName: 'Energia Elétrica', type: 'EXPENSE', confidence: 0.90 },

  // Água
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'CASAN', categoryName: 'Água e Esgoto', type: 'EXPENSE', confidence: 0.98 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'SABESP', categoryName: 'Água e Esgoto', type: 'EXPENSE', confidence: 0.98 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'CEDAE', categoryName: 'Água e Esgoto', type: 'EXPENSE', confidence: 0.98 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'COPASA', categoryName: 'Água e Esgoto', type: 'EXPENSE', confidence: 0.98 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'CORSAN', categoryName: 'Água e Esgoto', type: 'EXPENSE', confidence: 0.98 },

  // Telefonia + Gás
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'VIVO', categoryName: 'Telefonia e Internet', type: 'EXPENSE', confidence: 0.85 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'CLARO ', categoryName: 'Telefonia e Internet', type: 'EXPENSE', confidence: 0.85 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'TIM ', categoryName: 'Telefonia e Internet', type: 'EXPENSE', confidence: 0.85 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'OI MOVEL', categoryName: 'Telefonia e Internet', type: 'EXPENSE', confidence: 0.90 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'COMGAS', categoryName: 'Gás', type: 'EXPENSE', confidence: 0.98 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'SCGAS', categoryName: 'Gás', type: 'EXPENSE', confidence: 0.98 },

  // ═══════════════════════════════════════════════════════════════
  // UNIVERSAL — Cartões / Maquininhas (RECEITA)
  // ═══════════════════════════════════════════════════════════════
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'PAGAMENTO STONE', categoryName: 'Receita Cartão', type: 'INCOME', confidence: 0.95 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'CRED STONE', categoryName: 'Receita Cartão', type: 'INCOME', confidence: 0.95 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'CRED CARD STONE', categoryName: 'Receita Cartão', type: 'INCOME', confidence: 0.95 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'STONE D+', categoryName: 'Receita Cartão', type: 'INCOME', confidence: 0.95 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'PAGAMENTO CIELO', categoryName: 'Receita Cartão', type: 'INCOME', confidence: 0.95 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'CIELO LIQUIDACAO', categoryName: 'Receita Cartão', type: 'INCOME', confidence: 0.95 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'PAGAMENTO REDE', categoryName: 'Receita Cartão', type: 'INCOME', confidence: 0.95 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'GETNET', categoryName: 'Receita Cartão', type: 'INCOME', confidence: 0.95 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'PAGSEGURO', categoryName: 'Receita Cartão', type: 'INCOME', confidence: 0.95 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'PAGBANK', categoryName: 'Receita Cartão', type: 'INCOME', confidence: 0.95 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'MERCADO PAGO', categoryName: 'Receita Cartão', type: 'INCOME', confidence: 0.90 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'LIQUIDACAO ADQUIRENTE', categoryName: 'Receita Cartão', type: 'INCOME', confidence: 0.95 },

  // Taxas cartão (DESPESA)
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'TARIFA STONE', categoryName: 'Taxa Cartão', type: 'EXPENSE', confidence: 0.95 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'COMISSAO STONE', categoryName: 'Taxa Cartão', type: 'EXPENSE', confidence: 0.95 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'TARIFA CIELO', categoryName: 'Taxa Cartão', type: 'EXPENSE', confidence: 0.95 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'TARIFA REDE', categoryName: 'Taxa Cartão', type: 'EXPENSE', confidence: 0.95 },

  // ═══════════════════════════════════════════════════════════════
  // UNIVERSAL — Folha
  // ═══════════════════════════════════════════════════════════════
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'PAG FOLHA', categoryName: 'Salários', type: 'EXPENSE', confidence: 0.95 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'FOLHA PAGAMENTO', categoryName: 'Salários', type: 'EXPENSE', confidence: 0.95 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'REM FOLHA', categoryName: 'Salários', type: 'EXPENSE', confidence: 0.95 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'VALE TRANSPORTE', categoryName: 'Vale Transporte', type: 'EXPENSE', confidence: 0.95 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'VALE ALIMENTACAO', categoryName: 'Vale Alimentação', type: 'EXPENSE', confidence: 0.95 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'VALE REFEICAO', categoryName: 'Vale Refeição', type: 'EXPENSE', confidence: 0.95 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'TICKET LOG', categoryName: 'Vale Alimentação', type: 'EXPENSE', confidence: 0.90 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'SODEXO', categoryName: 'Vale Refeição', type: 'EXPENSE', confidence: 0.90 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'ALELO', categoryName: 'Vale Alimentação', type: 'EXPENSE', confidence: 0.90 },

  // ═══════════════════════════════════════════════════════════════
  // UNIVERSAL — Combustível / Postos
  // ═══════════════════════════════════════════════════════════════
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'POSTO ', categoryName: 'Combustível', type: 'EXPENSE', confidence: 0.85 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'SHELL', categoryName: 'Combustível', type: 'EXPENSE', confidence: 0.85 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'IPIRANGA', categoryName: 'Combustível', type: 'EXPENSE', confidence: 0.85 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'PETROBRAS', categoryName: 'Combustível', type: 'EXPENSE', confidence: 0.85 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'ALE COMBUSTIVEIS', categoryName: 'Combustível', type: 'EXPENSE', confidence: 0.90 },

  // Estornos (ANY)
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'ESTORNO', categoryName: 'Estornos', type: 'ANY', confidence: 0.85 },
  { setor: 'UNIVERSAL', matchType: 'CONTAINS', pattern: 'DEVOLUCAO', categoryName: 'Estornos', type: 'ANY', confidence: 0.85 },

  // ═══════════════════════════════════════════════════════════════
  // RESTAURANTE — Receitas delivery
  // ═══════════════════════════════════════════════════════════════
  { setor: 'RESTAURANTE', matchType: 'CONTAINS', pattern: 'IFOOD', categoryName: 'Receita Delivery (iFood)', type: 'INCOME', confidence: 0.98 },
  { setor: 'RESTAURANTE', matchType: 'CONTAINS', pattern: 'IFD*', categoryName: 'Receita Delivery (iFood)', type: 'INCOME', confidence: 0.95 },
  { setor: 'RESTAURANTE', matchType: 'CONTAINS', pattern: 'UBER EATS', categoryName: 'Receita Delivery (Uber Eats)', type: 'INCOME', confidence: 0.98 },
  { setor: 'RESTAURANTE', matchType: 'CONTAINS', pattern: 'RAPPI', categoryName: 'Receita Delivery (Rappi)', type: 'INCOME', confidence: 0.98 },
  { setor: 'RESTAURANTE', matchType: 'CONTAINS', pattern: '99FOOD', categoryName: 'Receita Delivery', type: 'INCOME', confidence: 0.95 },

  // Fornecedores Bebidas
  { setor: 'RESTAURANTE', matchType: 'CONTAINS', pattern: 'AMBEV', categoryName: 'Fornecedor Bebidas', type: 'EXPENSE', confidence: 0.98 },
  { setor: 'RESTAURANTE', matchType: 'CONTAINS', pattern: 'COCA-COLA', categoryName: 'Fornecedor Bebidas', type: 'EXPENSE', confidence: 0.98 },
  { setor: 'RESTAURANTE', matchType: 'CONTAINS', pattern: 'COCA COLA', categoryName: 'Fornecedor Bebidas', type: 'EXPENSE', confidence: 0.98 },
  { setor: 'RESTAURANTE', matchType: 'CONTAINS', pattern: 'HEINEKEN', categoryName: 'Fornecedor Bebidas', type: 'EXPENSE', confidence: 0.98 },
  { setor: 'RESTAURANTE', matchType: 'CONTAINS', pattern: 'BRASIL KIRIN', categoryName: 'Fornecedor Bebidas', type: 'EXPENSE', confidence: 0.98 },
  { setor: 'RESTAURANTE', matchType: 'CONTAINS', pattern: 'CERVEJARIA', categoryName: 'Fornecedor Bebidas', type: 'EXPENSE', confidence: 0.85 },

  // Fornecedores Carnes
  { setor: 'RESTAURANTE', matchType: 'CONTAINS', pattern: 'JBS', categoryName: 'Fornecedor Carnes', type: 'EXPENSE', confidence: 0.95 },
  { setor: 'RESTAURANTE', matchType: 'CONTAINS', pattern: 'FRIBOI', categoryName: 'Fornecedor Carnes', type: 'EXPENSE', confidence: 0.98 },
  { setor: 'RESTAURANTE', matchType: 'CONTAINS', pattern: 'MARFRIG', categoryName: 'Fornecedor Carnes', type: 'EXPENSE', confidence: 0.98 },
  { setor: 'RESTAURANTE', matchType: 'CONTAINS', pattern: 'BRF', categoryName: 'Fornecedor Carnes', type: 'EXPENSE', confidence: 0.90 },
  { setor: 'RESTAURANTE', matchType: 'CONTAINS', pattern: 'SADIA', categoryName: 'Fornecedor Carnes', type: 'EXPENSE', confidence: 0.98 },
  { setor: 'RESTAURANTE', matchType: 'CONTAINS', pattern: 'PERDIGAO', categoryName: 'Fornecedor Carnes', type: 'EXPENSE', confidence: 0.98 },
  { setor: 'RESTAURANTE', matchType: 'CONTAINS', pattern: 'SEARA', categoryName: 'Fornecedor Carnes', type: 'EXPENSE', confidence: 0.95 },
  { setor: 'RESTAURANTE', matchType: 'CONTAINS', pattern: 'FRIGORIFICO', categoryName: 'Fornecedor Carnes', type: 'EXPENSE', confidence: 0.90 },
  { setor: 'RESTAURANTE', matchType: 'CONTAINS', pattern: 'AVICOLA', categoryName: 'Fornecedor Carnes', type: 'EXPENSE', confidence: 0.90 },

  // Atacadistas
  { setor: 'RESTAURANTE', matchType: 'CONTAINS', pattern: 'ATACADAO', categoryName: 'Compras Mercadoria', type: 'EXPENSE', confidence: 0.95 },
  { setor: 'RESTAURANTE', matchType: 'CONTAINS', pattern: 'ASSAI', categoryName: 'Compras Mercadoria', type: 'EXPENSE', confidence: 0.95 },
  { setor: 'RESTAURANTE', matchType: 'CONTAINS', pattern: 'MAKRO', categoryName: 'Compras Mercadoria', type: 'EXPENSE', confidence: 0.95 },
  { setor: 'RESTAURANTE', matchType: 'CONTAINS', pattern: 'TENDA ATACADO', categoryName: 'Compras Mercadoria', type: 'EXPENSE', confidence: 0.95 },
  { setor: 'RESTAURANTE', matchType: 'CONTAINS', pattern: 'SAM CLUB', categoryName: 'Compras Mercadoria', type: 'EXPENSE', confidence: 0.95 },

  // Insumos + plataforma delivery
  { setor: 'RESTAURANTE', matchType: 'CONTAINS', pattern: 'HORTIFRUTI', categoryName: 'Hortifruti', type: 'EXPENSE', confidence: 0.90 },
  { setor: 'RESTAURANTE', matchType: 'CONTAINS', pattern: 'PADARIA', categoryName: 'Padaria/Confeitaria', type: 'EXPENSE', confidence: 0.85 },
  { setor: 'RESTAURANTE', matchType: 'CONTAINS', pattern: 'CEAGESP', categoryName: 'Hortifruti', type: 'EXPENSE', confidence: 0.95 },
  { setor: 'RESTAURANTE', matchType: 'CONTAINS', pattern: 'COMISSAO IFOOD', categoryName: 'Taxa Plataforma Delivery', type: 'EXPENSE', confidence: 0.95 },

  // ═══════════════════════════════════════════════════════════════
  // ACADEMIA — Receitas + Suplementos + Equipamentos + Software + Marketing
  // ═══════════════════════════════════════════════════════════════
  { setor: 'ACADEMIA', matchType: 'CONTAINS', pattern: 'GYMPASS', categoryName: 'Receita Gympass/Wellhub', type: 'INCOME', confidence: 0.98 },
  { setor: 'ACADEMIA', matchType: 'CONTAINS', pattern: 'WELLHUB', categoryName: 'Receita Gympass/Wellhub', type: 'INCOME', confidence: 0.98 },
  { setor: 'ACADEMIA', matchType: 'CONTAINS', pattern: 'TOTALPASS', categoryName: 'Receita TotalPass', type: 'INCOME', confidence: 0.95 },

  { setor: 'ACADEMIA', matchType: 'CONTAINS', pattern: 'GROWTH', categoryName: 'Compras Suplementos (Revenda)', type: 'EXPENSE', confidence: 0.85 },
  { setor: 'ACADEMIA', matchType: 'CONTAINS', pattern: 'MAX TITANIUM', categoryName: 'Compras Suplementos (Revenda)', type: 'EXPENSE', confidence: 0.95 },
  { setor: 'ACADEMIA', matchType: 'CONTAINS', pattern: 'INTEGRALMEDICA', categoryName: 'Compras Suplementos (Revenda)', type: 'EXPENSE', confidence: 0.95 },
  { setor: 'ACADEMIA', matchType: 'CONTAINS', pattern: 'PROBIOTICA', categoryName: 'Compras Suplementos (Revenda)', type: 'EXPENSE', confidence: 0.95 },
  { setor: 'ACADEMIA', matchType: 'CONTAINS', pattern: 'BLACK SKULL', categoryName: 'Compras Suplementos (Revenda)', type: 'EXPENSE', confidence: 0.95 },

  { setor: 'ACADEMIA', matchType: 'CONTAINS', pattern: 'MOVEMENT', categoryName: 'Equipamentos Academia', type: 'EXPENSE', confidence: 0.90 },
  { setor: 'ACADEMIA', matchType: 'CONTAINS', pattern: 'RIGHETTO', categoryName: 'Equipamentos Academia', type: 'EXPENSE', confidence: 0.95 },
  { setor: 'ACADEMIA', matchType: 'CONTAINS', pattern: 'FLEX EQUIPMENT', categoryName: 'Equipamentos Academia', type: 'EXPENSE', confidence: 0.95 },

  { setor: 'ACADEMIA', matchType: 'CONTAINS', pattern: 'PACT', categoryName: 'Software Gestão Academia', type: 'EXPENSE', confidence: 0.80 },
  { setor: 'ACADEMIA', matchType: 'CONTAINS', pattern: 'TECNOFIT', categoryName: 'Software Gestão Academia', type: 'EXPENSE', confidence: 0.95 },
  { setor: 'ACADEMIA', matchType: 'CONTAINS', pattern: 'W12', categoryName: 'Software Gestão Academia', type: 'EXPENSE', confidence: 0.85 },
  { setor: 'ACADEMIA', matchType: 'CONTAINS', pattern: 'EVO ACADEMIA', categoryName: 'Software Gestão Academia', type: 'EXPENSE', confidence: 0.95 },

  { setor: 'ACADEMIA', matchType: 'CONTAINS', pattern: 'META PLATFORMS', categoryName: 'Marketing Digital', type: 'EXPENSE', confidence: 0.95 },
  { setor: 'ACADEMIA', matchType: 'CONTAINS', pattern: 'FACEBOOK ADS', categoryName: 'Marketing Digital', type: 'EXPENSE', confidence: 0.95 },
  { setor: 'ACADEMIA', matchType: 'CONTAINS', pattern: 'GOOGLE ADS', categoryName: 'Marketing Digital', type: 'EXPENSE', confidence: 0.95 },
  { setor: 'ACADEMIA', matchType: 'CONTAINS', pattern: 'GOOGLE BR', categoryName: 'Marketing Digital', type: 'EXPENSE', confidence: 0.85 },

  // ═══════════════════════════════════════════════════════════════
  // COMERCIO_ROUPA — Têxtil + E-commerce + Frete
  // ═══════════════════════════════════════════════════════════════
  { setor: 'COMERCIO_ROUPA', matchType: 'CONTAINS', pattern: 'HERING', categoryName: 'Compras Mercadoria', type: 'EXPENSE', confidence: 0.90 },
  { setor: 'COMERCIO_ROUPA', matchType: 'CONTAINS', pattern: 'MALWEE', categoryName: 'Compras Mercadoria', type: 'EXPENSE', confidence: 0.95 },
  { setor: 'COMERCIO_ROUPA', matchType: 'CONTAINS', pattern: 'MARISOL', categoryName: 'Compras Mercadoria', type: 'EXPENSE', confidence: 0.95 },
  { setor: 'COMERCIO_ROUPA', matchType: 'CONTAINS', pattern: 'CONFECCAO', categoryName: 'Compras Mercadoria', type: 'EXPENSE', confidence: 0.85 },
  { setor: 'COMERCIO_ROUPA', matchType: 'CONTAINS', pattern: 'TEXTIL', categoryName: 'Compras Mercadoria', type: 'EXPENSE', confidence: 0.85 },

  { setor: 'COMERCIO_ROUPA', matchType: 'CONTAINS', pattern: 'MERCADO LIVRE', categoryName: 'Receita E-commerce (ML)', type: 'INCOME', confidence: 0.90 },
  { setor: 'COMERCIO_ROUPA', matchType: 'CONTAINS', pattern: 'SHOPEE', categoryName: 'Receita E-commerce (Shopee)', type: 'INCOME', confidence: 0.90 },
  { setor: 'COMERCIO_ROUPA', matchType: 'CONTAINS', pattern: 'AMAZON SELLER', categoryName: 'Receita E-commerce (Amazon)', type: 'INCOME', confidence: 0.95 },

  { setor: 'COMERCIO_ROUPA', matchType: 'CONTAINS', pattern: 'JADLOG', categoryName: 'Frete', type: 'EXPENSE', confidence: 0.98 },
  { setor: 'COMERCIO_ROUPA', matchType: 'CONTAINS', pattern: 'TOTAL EXPRESS', categoryName: 'Frete', type: 'EXPENSE', confidence: 0.98 },
  { setor: 'COMERCIO_ROUPA', matchType: 'CONTAINS', pattern: 'MELHOR ENVIO', categoryName: 'Frete', type: 'EXPENSE', confidence: 0.95 },
  { setor: 'COMERCIO_ROUPA', matchType: 'CONTAINS', pattern: 'CORREIOS', categoryName: 'Frete', type: 'EXPENSE', confidence: 0.95 },
  { setor: 'COMERCIO_ROUPA', matchType: 'CONTAINS', pattern: 'LOGGI', categoryName: 'Frete', type: 'EXPENSE', confidence: 0.90 },
  { setor: 'COMERCIO_ROUPA', matchType: 'CONTAINS', pattern: 'TRANSPORTADORA', categoryName: 'Frete', type: 'EXPENSE', confidence: 0.85 },

  // ═══════════════════════════════════════════════════════════════
  // VAREJO_GERAL — Básico
  // ═══════════════════════════════════════════════════════════════
  { setor: 'VAREJO_GERAL', matchType: 'CONTAINS', pattern: 'DISTRIBUIDORA', categoryName: 'Compras Mercadoria', type: 'EXPENSE', confidence: 0.80 },
  { setor: 'VAREJO_GERAL', matchType: 'CONTAINS', pattern: 'COMERCIAL', categoryName: 'Compras Mercadoria', type: 'EXPENSE', confidence: 0.70 },
]

// Sets distintos pra ensureAllSystemCategories — quais categorias devem ser
// criadas no plano de contas pra que matchSetorPattern resolva categoryId.
export function categoriesNeededForSetor(setor: SetorEnum): Set<string> {
  const set = new Set<string>()
  for (const p of SETOR_PATTERNS_SEED) {
    if (p.setor === 'UNIVERSAL' || p.setor === setor) {
      set.add(p.categoryName)
    }
  }
  return set
}

export const VALID_SETORES: ReadonlyArray<SetorEnum> = [
  'UNIVERSAL',
  'RESTAURANTE',
  'ACADEMIA',
  'COMERCIO_ROUPA',
  'VAREJO_GERAL',
]

/**
 * Mapping de cada categoryName referenciada no seed → dreGroup canônico do DRE.
 * Usado por ensureAllSystemCategoriesForSetor pra criar categorias com dreGroup correto.
 *
 * Quando categoryName NÃO está aqui, fallback é OUTRAS_DESPESAS (não quebra,
 * mas o user pode reclassificar).
 */
export const CATEGORY_NAME_TO_DRE_GROUP: Record<string, string> = {
  // Receitas
  'Receita Cartão': 'RECEITA_BRUTA',
  'Receita Pix': 'RECEITA_BRUTA',
  'Receita TED': 'RECEITA_BRUTA',
  'Receita Boleto': 'RECEITA_BRUTA',
  'Receita Delivery': 'RECEITA_BRUTA',
  'Receita Delivery (iFood)': 'RECEITA_BRUTA',
  'Receita Delivery (Uber Eats)': 'RECEITA_BRUTA',
  'Receita Delivery (Rappi)': 'RECEITA_BRUTA',
  'Receita E-commerce (ML)': 'RECEITA_BRUTA',
  'Receita E-commerce (Shopee)': 'RECEITA_BRUTA',
  'Receita E-commerce (Amazon)': 'RECEITA_BRUTA',
  'Receita Gympass/Wellhub': 'RECEITA_BRUTA',
  'Receita TotalPass': 'RECEITA_BRUTA',
  // Tributos federais/estaduais/municipais
  'Tributos Federais': 'IMPOSTOS_SOBRE_LUCRO',
  'DAS Simples Nacional': 'IMPOSTOS_SOBRE_LUCRO',
  'DAS MEI': 'IMPOSTOS_SOBRE_LUCRO',
  INSS: 'DESPESAS_PESSOAL',
  FGTS: 'DESPESAS_PESSOAL',
  ICMS: 'DEDUCOES',
  'ICMS-ST': 'DEDUCOES',
  ISS: 'DEDUCOES',
  IPTU: 'DESPESAS_ADMINISTRATIVAS',
  IPVA: 'DESPESAS_ADMINISTRATIVAS',
  // Bancárias
  'Tarifas Bancárias': 'DESPESAS_FINANCEIRAS',
  'Juros e Encargos': 'DESPESAS_FINANCEIRAS',
  'Taxa Cartão': 'DESPESAS_FINANCEIRAS',
  // Utilidades
  'Energia Elétrica': 'DESPESAS_ADMINISTRATIVAS',
  'Água e Esgoto': 'DESPESAS_ADMINISTRATIVAS',
  'Telefonia e Internet': 'DESPESAS_ADMINISTRATIVAS',
  Gás: 'DESPESAS_ADMINISTRATIVAS',
  // Folha
  Salários: 'DESPESAS_PESSOAL',
  'Vale Transporte': 'DESPESAS_PESSOAL',
  'Vale Alimentação': 'DESPESAS_PESSOAL',
  'Vale Refeição': 'DESPESAS_PESSOAL',
  // Operacionais universais
  Aluguel: 'DESPESAS_ADMINISTRATIVAS',
  Condomínio: 'DESPESAS_ADMINISTRATIVAS',
  Combustível: 'DESPESAS_ADMINISTRATIVAS',
  Estornos: 'OUTRAS_RECEITAS',
  // Restaurante
  'Fornecedor Bebidas': 'CUSTO_PRODUTO_VENDIDO',
  'Fornecedor Carnes': 'CUSTO_PRODUTO_VENDIDO',
  'Compras Mercadoria': 'CUSTO_PRODUTO_VENDIDO',
  Hortifruti: 'CUSTO_PRODUTO_VENDIDO',
  'Padaria/Confeitaria': 'CUSTO_PRODUTO_VENDIDO',
  'Taxa Plataforma Delivery': 'DESPESAS_COMERCIAIS',
  // Academia
  'Compras Suplementos (Revenda)': 'CUSTO_PRODUTO_VENDIDO',
  'Equipamentos Academia': 'DESPESAS_ADMINISTRATIVAS',
  'Software Gestão Academia': 'DESPESAS_ADMINISTRATIVAS',
  'Marketing Digital': 'DESPESAS_COMERCIAIS',
  // Comércio
  Frete: 'DESPESAS_COMERCIAIS',
}

/**
 * Type INCOME/EXPENSE/TRANSFER pra cada categoryName.
 * Derivado do tipo majoritário entre os padrões que referenciam o nome.
 */
export function categoryTypeForName(
  categoryName: string,
): 'INCOME' | 'EXPENSE' | 'TRANSFER' {
  // Heurística: nomes que começam com "Receita" são INCOME, resto EXPENSE
  if (/^Receita\b/i.test(categoryName)) return 'INCOME'
  if (categoryName === 'Estornos') return 'INCOME' // estorno = entrada típica
  return 'EXPENSE'
}
