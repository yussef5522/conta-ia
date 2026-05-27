// Sprint 5.0.2.s — Plano de contas CONTÁBIL setorial.
//
// Cada setor tem nomes específicos que respeitam terminologia contábil BR:
//   - RESTAURANTE: "Matéria-Prima" pra insumos do CMV (não "Fornecedor")
//   - ACADEMIA: "Mercadoria Revenda" pra suplementos (não "Compras")
//   - COMERCIO_ROUPA: "Mercadoria Revenda" pra confecções
//
// Diferente do `prisma/seeds/setor-patterns.ts` (KB de matching por nome de
// vendor), aqui definimos o PLANO DE CONTAS — categorias que existem no
// plano com classificação contábil correta.

export type SetorPlano = 'RESTAURANTE' | 'ACADEMIA' | 'COMERCIO_ROUPA' | 'VAREJO_GERAL'

export interface ContaSetorial {
  /** Nome canônico (vai pra Category.name) */
  nome: string
  /** Código contábil padrão SPED (ex: "3.1.01.001") */
  codigo: string
  /** Tipo Category (INCOME/EXPENSE/TRANSFER) */
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER'
  /** Grupo do DRE Gerencial (lib/dre-groups/) */
  dreGroup: string
  /** Gera crédito PIS/COFINS Lucro Real */
  isCreditavel?: boolean
  /** Descrição amigável (helper visual) */
  descricao?: string
}

// ────────────────────────────────────────────────────────────────────────
// CATEGORIAS UNIVERSAIS (toda empresa tem — independente do setor)
// ────────────────────────────────────────────────────────────────────────
const UNIVERSAIS: ReadonlyArray<ContaSetorial> = [
  // RECEITAS COMUNS
  { nome: 'Receita Cartão', codigo: '4.1.03', type: 'INCOME', dreGroup: 'RECEITA_BRUTA' },
  { nome: 'Receita Pix', codigo: '4.1.04', type: 'INCOME', dreGroup: 'RECEITA_BRUTA' },
  { nome: 'Receita TED', codigo: '4.1.05', type: 'INCOME', dreGroup: 'RECEITA_BRUTA' },
  { nome: 'Receita Boleto', codigo: '4.1.06', type: 'INCOME', dreGroup: 'RECEITA_BRUTA' },

  // OPERACIONAIS COMUNS
  { nome: 'Salários', codigo: '3.2.01.001', type: 'EXPENSE', dreGroup: 'DESPESAS_PESSOAL' },
  { nome: 'Vale Transporte', codigo: '3.2.01.002', type: 'EXPENSE', dreGroup: 'DESPESAS_PESSOAL' },
  { nome: 'Vale Refeição', codigo: '3.2.01.003', type: 'EXPENSE', dreGroup: 'DESPESAS_PESSOAL' },
  { nome: 'Vale Alimentação', codigo: '3.2.01.004', type: 'EXPENSE', dreGroup: 'DESPESAS_PESSOAL' },
  { nome: 'Aluguel', codigo: '3.2.02.001', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS' },
  { nome: 'Condomínio', codigo: '3.2.02.002', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS' },
  { nome: 'Energia Elétrica', codigo: '3.2.03.001', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', isCreditavel: true },
  { nome: 'Água e Esgoto', codigo: '3.2.03.002', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS' },
  { nome: 'Gás', codigo: '3.2.03.003', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', isCreditavel: true },
  { nome: 'Telefonia e Internet', codigo: '3.2.03.004', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS' },
  { nome: 'Software/Tecnologia', codigo: '3.2.04.001', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS' },
  { nome: 'Assinaturas', codigo: '3.2.04.002', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS' },
  { nome: 'Marketing Digital', codigo: '3.2.05.001', type: 'EXPENSE', dreGroup: 'DESPESAS_COMERCIAIS' },
  { nome: 'Combustível', codigo: '3.2.08.001', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS' },
  { nome: 'Frete', codigo: '3.2.08.002', type: 'EXPENSE', dreGroup: 'DESPESAS_COMERCIAIS', isCreditavel: true },
  { nome: 'Honorários Contábeis', codigo: '3.2.09.001', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS' },
  { nome: 'Honorários Jurídicos', codigo: '3.2.09.002', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS' },
  // Sprint 5.0.2.t — Prestadores PF (CARLA FABIANA SCHWEIG-style)
  { nome: 'Serviços PF (Prestadores)', codigo: '3.2.09.003', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS' },

  // TRIBUTÁRIAS
  { nome: 'DAS Simples Nacional', codigo: '3.3.01.001', type: 'EXPENSE', dreGroup: 'IMPOSTOS_SOBRE_LUCRO' },
  { nome: 'DAS MEI', codigo: '3.3.01.002', type: 'EXPENSE', dreGroup: 'IMPOSTOS_SOBRE_LUCRO' },
  { nome: 'Tributos Federais', codigo: '3.3.01.003', type: 'EXPENSE', dreGroup: 'IMPOSTOS_SOBRE_LUCRO' },
  { nome: 'ICMS', codigo: '3.3.01.004', type: 'EXPENSE', dreGroup: 'DEDUCOES' },
  { nome: 'ICMS-ST', codigo: '3.3.01.005', type: 'EXPENSE', dreGroup: 'DEDUCOES' },
  { nome: 'ISS', codigo: '3.3.01.006', type: 'EXPENSE', dreGroup: 'DEDUCOES' },
  { nome: 'IPTU', codigo: '3.3.01.007', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS' },
  { nome: 'IPVA', codigo: '3.3.01.008', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS' },
  { nome: 'INSS', codigo: '3.3.02.001', type: 'EXPENSE', dreGroup: 'DESPESAS_PESSOAL' },
  { nome: 'FGTS', codigo: '3.3.02.002', type: 'EXPENSE', dreGroup: 'DESPESAS_PESSOAL' },

  // FINANCEIRAS
  { nome: 'Tarifas Bancárias', codigo: '3.4.01.001', type: 'EXPENSE', dreGroup: 'DESPESAS_FINANCEIRAS' },
  { nome: 'Juros e Encargos', codigo: '3.4.01.002', type: 'EXPENSE', dreGroup: 'DESPESAS_FINANCEIRAS' },
  { nome: 'Taxa Cartão', codigo: '3.4.01.003', type: 'EXPENSE', dreGroup: 'DESPESAS_FINANCEIRAS' },

  // ESTORNOS
  { nome: 'Estornos', codigo: '4.2.99', type: 'INCOME', dreGroup: 'OUTRAS_RECEITAS' },
]

// ────────────────────────────────────────────────────────────────────────
// RESTAURANTE — CMV é Matéria-Prima (não "Fornecedor")
// ────────────────────────────────────────────────────────────────────────
const RESTAURANTE: ReadonlyArray<ContaSetorial> = [
  // CMV — Matéria-Prima (gera crédito Lucro Real)
  { nome: 'Matéria-Prima - Alimentos', codigo: '3.1.01.001', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', isCreditavel: true, descricao: 'Insumos alimentares genéricos' },
  { nome: 'Matéria-Prima - Bebidas', codigo: '3.1.01.002', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', isCreditavel: true },
  { nome: 'Matéria-Prima - Carnes', codigo: '3.1.01.003', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', isCreditavel: true },
  { nome: 'Matéria-Prima - Hortifruti', codigo: '3.1.01.004', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', isCreditavel: true },
  { nome: 'Matéria-Prima - Outros Insumos', codigo: '3.1.01.005', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', isCreditavel: true },
  { nome: 'Embalagens - Delivery', codigo: '3.1.02.001', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', isCreditavel: true },
  { nome: 'Embalagens - Descartáveis', codigo: '3.1.02.002', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', isCreditavel: true },

  // RECEITAS específicas
  { nome: 'Receita Delivery (iFood)', codigo: '4.1.01.001', type: 'INCOME', dreGroup: 'RECEITA_BRUTA' },
  { nome: 'Receita Delivery (Uber Eats)', codigo: '4.1.01.002', type: 'INCOME', dreGroup: 'RECEITA_BRUTA' },
  { nome: 'Receita Delivery (Rappi)', codigo: '4.1.01.003', type: 'INCOME', dreGroup: 'RECEITA_BRUTA' },
  { nome: 'Receita Delivery', codigo: '4.1.01.004', type: 'INCOME', dreGroup: 'RECEITA_BRUTA' },

  // Despesas operacionais específicas
  { nome: 'Taxa Plataforma Delivery', codigo: '3.2.05.002', type: 'EXPENSE', dreGroup: 'DESPESAS_COMERCIAIS' },
  { nome: 'Material de Limpeza', codigo: '3.2.07.001', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS' },
]

// ────────────────────────────────────────────────────────────────────────
// ACADEMIA — CMV é Mercadoria Revenda (suplementos)
// ────────────────────────────────────────────────────────────────────────
const ACADEMIA: ReadonlyArray<ContaSetorial> = [
  { nome: 'Mercadoria Revenda - Suplementos', codigo: '3.1.01.001', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', isCreditavel: true },
  { nome: 'Mercadoria Revenda - Acessórios', codigo: '3.1.01.002', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', isCreditavel: true },
  { nome: 'Material de Treino', codigo: '3.1.02.001', type: 'EXPENSE', dreGroup: 'DESPESAS_OPERACIONAIS' },
  { nome: 'Equipamentos Academia', codigo: '3.1.02.002', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS' },

  // Receitas
  { nome: 'Receita Gympass/Wellhub', codigo: '4.1.02.001', type: 'INCOME', dreGroup: 'RECEITA_BRUTA' },
  { nome: 'Receita TotalPass', codigo: '4.1.02.002', type: 'INCOME', dreGroup: 'RECEITA_BRUTA' },

  // Software específico
  { nome: 'Software Gestão Academia', codigo: '3.2.04.003', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS' },
]

// ────────────────────────────────────────────────────────────────────────
// COMERCIO_ROUPA — CMV é Mercadoria Revenda Confecções
// ────────────────────────────────────────────────────────────────────────
const COMERCIO_ROUPA: ReadonlyArray<ContaSetorial> = [
  { nome: 'Mercadoria Revenda - Confecções', codigo: '3.1.01.001', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', isCreditavel: true },
  { nome: 'Mercadoria Revenda - Acessórios', codigo: '3.1.01.002', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', isCreditavel: true },
  { nome: 'Embalagens Loja', codigo: '3.1.02.001', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', isCreditavel: true },

  // E-commerce
  { nome: 'Receita E-commerce (ML)', codigo: '4.1.02.001', type: 'INCOME', dreGroup: 'RECEITA_BRUTA' },
  { nome: 'Receita E-commerce (Shopee)', codigo: '4.1.02.002', type: 'INCOME', dreGroup: 'RECEITA_BRUTA' },
  { nome: 'Receita E-commerce (Amazon)', codigo: '4.1.02.003', type: 'INCOME', dreGroup: 'RECEITA_BRUTA' },
]

// ────────────────────────────────────────────────────────────────────────
// VAREJO_GERAL — fallback genérico
// ────────────────────────────────────────────────────────────────────────
const VAREJO_GERAL: ReadonlyArray<ContaSetorial> = [
  { nome: 'Mercadoria para Revenda', codigo: '3.1.01.001', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', isCreditavel: true },
  { nome: 'Compras Mercadoria', codigo: '3.1.01.002', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', isCreditavel: true },
  { nome: 'Material de Embalagem', codigo: '3.1.02.001', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', isCreditavel: true },
]

const SETOR_MAP: Record<SetorPlano, ReadonlyArray<ContaSetorial>> = {
  RESTAURANTE,
  ACADEMIA,
  COMERCIO_ROUPA,
  VAREJO_GERAL,
}

/**
 * Retorna o plano completo (UNIVERSAIS + categorias específicas do setor).
 * Idempotente: caller usa nome+dreGroup como chave natural.
 */
export function planoContasParaSetor(
  setor: SetorPlano | string | null | undefined,
): ContaSetorial[] {
  const especificas =
    setor && setor in SETOR_MAP
      ? SETOR_MAP[setor as SetorPlano]
      : VAREJO_GERAL
  return [...UNIVERSAIS, ...especificas]
}

/**
 * Mapping legado → novo nome contábil (pra script de migração).
 * Por setor — Restaurante usa Matéria-Prima, Comércio usa Revenda.
 */
export function mapearCategoriaLegada(
  nomeAntigo: string,
  setor: SetorPlano | string | null | undefined,
): string | null {
  const setorKey =
    setor && setor in SETOR_MAP ? (setor as SetorPlano) : 'VAREJO_GERAL'

  const MAPPING: Record<SetorPlano, Record<string, string>> = {
    RESTAURANTE: {
      'Fornecedor Alimentos': 'Matéria-Prima - Outros Insumos',
      'Fornecedor Bebidas': 'Matéria-Prima - Bebidas',
      'Fornecedor Carnes': 'Matéria-Prima - Carnes',
      'Compras Mercadoria': 'Matéria-Prima - Outros Insumos',
      Hortifruti: 'Matéria-Prima - Hortifruti',
      'Material de Embalagem': 'Embalagens - Descartáveis',
      'Padaria/Confeitaria': 'Matéria-Prima - Outros Insumos',
    },
    ACADEMIA: {
      'Compras Suplementos (Revenda)': 'Mercadoria Revenda - Suplementos',
      'Equipamentos Academia': 'Equipamentos Academia',
      'Software Gestão Academia': 'Software Gestão Academia',
    },
    COMERCIO_ROUPA: {
      'Compras Mercadoria': 'Mercadoria Revenda - Confecções',
    },
    VAREJO_GERAL: {
      'Compras Mercadoria': 'Mercadoria para Revenda',
    },
  }
  return MAPPING[setorKey]?.[nomeAntigo] ?? null
}
