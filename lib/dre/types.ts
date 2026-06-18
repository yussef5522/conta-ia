// Tipos da Engine DRE (Sub-etapa 5.4.A).
// Estrutura conforme Lei 6.404/76 + CPC 26 + NBC TG 26.
//
// Vocabulário de DREGroup alinhado com os templates de plano de contas
// já em produção (lib/categories/templates/_common.ts:DRE_GROUPS).
// Decisão de produto registrada no log da sessão de 03/05/2026:
//   - DESPESAS_PESSOAL fica em LINHA SEPARADA (crítico pra academias).
//   - DISTRIBUICAO_LUCROS, INVESTIMENTOS e TRANSFERENCIA NÃO entram no
//     DRE — são reportados em `nonDreGroups` pra a UI mostrar
//     separadamente que existem mas não afetam o resultado do exercício.

// ============================================================
// Grupos da DRE (ordem oficial BR)
// ============================================================

export type DREGroup =
  | 'RECEITA_BRUTA'              // Vendas/Serviços brutos
  | 'DEDUCOES'                   // Impostos s/ vendas, devoluções, descontos incondicionais
  | 'CUSTO_PRODUTO_VENDIDO'      // CMV/CSP — custo dos produtos/serviços vendidos
  | 'OUTRAS_RECEITAS'            // Outras receitas operacionais
  | 'DESPESAS_PESSOAL'           // Folha + encargos (linha separada — crítico em serviços)
  | 'DESPESAS_COMERCIAIS'        // Comissões, marketing, vendas
  | 'DESPESAS_ADMINISTRATIVAS'   // Aluguel, contabilidade, escritório
  | 'OUTRAS_DESPESAS'            // Outras despesas operacionais
  | 'RECEITAS_FINANCEIRAS'       // Juros recebidos, rendimentos
  | 'DESPESAS_FINANCEIRAS'       // Juros pagos, taxas bancárias
  | 'IMPOSTOS_SOBRE_LUCRO'       // IRPJ + CSLL

// Grupos NÃO-DRE: existem como categorias do plano de contas mas
// não compõem o resultado do exercício. Reportados separadamente.
export type NonDREGroup =
  | 'DISTRIBUICAO_LUCROS'
  | 'INVESTIMENTOS'
  | 'TRANSFERENCIA'
  // Ajuste técnico de saldo inicial (Sprint 1.5). Lançamento que faz o saldo
  // do sistema bater com o extrato real do banco. NÃO é receita nem despesa —
  // só corrige o ponto de partida. Aparece como linha informativa no DRE.
  | 'AJUSTE_SALDO'

export const NON_DRE_GROUPS: NonDREGroup[] = [
  'DISTRIBUICAO_LUCROS',
  'INVESTIMENTOS',
  'TRANSFERENCIA',
  'AJUSTE_SALDO',
]

// Set pra lookup O(1) — usado pelo calculator.
export const NON_DRE_GROUP_SET: ReadonlySet<string> = new Set<string>(NON_DRE_GROUPS)

export const DRE_GROUP_ORDER: DREGroup[] = [
  'RECEITA_BRUTA',
  'DEDUCOES',
  'CUSTO_PRODUTO_VENDIDO',
  'OUTRAS_RECEITAS',
  'DESPESAS_PESSOAL',
  'DESPESAS_COMERCIAIS',
  'DESPESAS_ADMINISTRATIVAS',
  'OUTRAS_DESPESAS',
  'RECEITAS_FINANCEIRAS',
  'DESPESAS_FINANCEIRAS',
  'IMPOSTOS_SOBRE_LUCRO',
]

export const DRE_GROUP_SET: ReadonlySet<string> = new Set<string>(DRE_GROUP_ORDER)

// Labels oficiais Lei 6.404/76.
export const DRE_GROUP_LABELS: Record<DREGroup, string> = {
  RECEITA_BRUTA: 'Receita Bruta',
  DEDUCOES: '(-) Deduções da Receita Bruta',
  CUSTO_PRODUTO_VENDIDO: '(-) Custo dos Produtos/Serviços Vendidos',
  OUTRAS_RECEITAS: '(+) Outras Receitas Operacionais',
  DESPESAS_PESSOAL: '(-) Despesas com Pessoal',
  DESPESAS_COMERCIAIS: '(-) Despesas Comerciais',
  DESPESAS_ADMINISTRATIVAS: '(-) Despesas Administrativas',
  OUTRAS_DESPESAS: '(-) Outras Despesas Operacionais',
  RECEITAS_FINANCEIRAS: '(+) Receitas Financeiras',
  DESPESAS_FINANCEIRAS: '(-) Despesas Financeiras',
  IMPOSTOS_SOBRE_LUCRO: '(-) IRPJ e CSLL',
}

// Sinal do grupo: positivo (soma) ou negativo (subtrai).
export const DRE_GROUP_SIGN: Record<DREGroup, 'positive' | 'negative'> = {
  RECEITA_BRUTA: 'positive',
  DEDUCOES: 'negative',
  CUSTO_PRODUTO_VENDIDO: 'negative',
  OUTRAS_RECEITAS: 'positive',
  DESPESAS_PESSOAL: 'negative',
  DESPESAS_COMERCIAIS: 'negative',
  DESPESAS_ADMINISTRATIVAS: 'negative',
  OUTRAS_DESPESAS: 'negative',
  RECEITAS_FINANCEIRAS: 'positive',
  DESPESAS_FINANCEIRAS: 'negative',
  IMPOSTOS_SOBRE_LUCRO: 'negative',
}

// Labels dos grupos não-DRE (pra UI).
export const NON_DRE_GROUP_LABELS: Record<NonDREGroup, string> = {
  DISTRIBUICAO_LUCROS: 'Distribuição de Lucros / Pró-labore',
  INVESTIMENTOS: 'Investimentos',
  TRANSFERENCIA: 'Transferências entre Contas',
  AJUSTE_SALDO: 'Ajustes Técnicos de Saldo',
}

// ============================================================
// Regime contábil
// ============================================================

export type RegimeContabil = 'competence' | 'cash'

// ============================================================
// Tipos de comparação
// ============================================================

export type ComparisonType =
  | 'none'                      // sem comparação
  | 'previous_period'           // período anterior (mesma duração)
  | 'same_period_last_year'     // mesmo período ano anterior
  | 'previous_year'             // ano anterior completo
  | 'ytd_vs_ytd'                // year-to-date vs YTD do ano anterior
  | 'custom'                    // período custom

// ============================================================
// Input do calculator
// ============================================================

export interface TransactionForDRE {
  id: string
  // TRANSFER existe pra transferências entre contas da mesma empresa (Sprint 0.5).
  // O engine pula TRANSFER pra não inflar receita/despesa do DRE.
  type: 'CREDIT' | 'DEBIT' | 'TRANSFER'
  amount: number               // sempre positivo (sinal vem do DREGroup)
  date: Date                   // data da transação (fallback se data específica do regime ausente)
  competenceDate: Date | null
  paymentDate: Date | null
  categoryId: string | null

  // ============================================================
  // Sprint Empréstimos Backend (17/06/2026)
  // ============================================================
  /**
   * True quando a tx é a LIBERAÇÃO de algum Loan (CREDIT que entrou na conta
   * como passivo, não receita). O engine PULA essas tx — não conta como
   * receita do DRE. Caller resolve via Loan.disbursementTransactionId.
   */
  isLoanDisbursement?: boolean
  /**
   * Quando setado, a tx é PAGAMENTO DE PARCELA de empréstimo. O engine usa
   * APENAS este valor (juros) no DRE, ignorando o amount original. A
   * amortização (= amount - loanInterestSplit) NÃO entra no DRE — é baixa
   * de passivo, não despesa. Caller resolve via
   * LoanInstallment.reconciledTransactionId + installment.interest.
   */
  loanInterestSplit?: number
}

export interface CategoryForDRE {
  id: string
  name: string
  code: string | null
  dreGroup: string             // string do banco (pode ser DREGroup, NonDREGroup, ou outro)
  parentId: string | null
  isActive: boolean
  type: 'CREDIT' | 'DEBIT' | string  // tipo da categoria
}

export interface DREPeriod {
  startDate: Date
  endDate: Date
  regime: RegimeContabil
}

export interface CalculateDREOptions {
  period: DREPeriod
  comparison?: {
    type: ComparisonType
    period?: DREPeriod  // se type = 'custom'
  }
}

// ============================================================
// Output do calculator
// ============================================================

export interface DRECategoryItem {
  category: {
    id: string
    name: string
    code: string | null
  }
  total: number
  transactionCount: number

  // Análises (preenchidas se aplicável)
  verticalPct: number | null    // % sobre Receita Líquida
  horizontalDelta: number | null // delta vs período comparação
  horizontalPct: number | null  // % de variação

  children: DRECategoryItem[]
}

export interface DREGroupResult {
  group: DREGroup
  groupLabel: string
  sign: 'positive' | 'negative'

  categories: DRECategoryItem[]
  total: number                 // soma das categorias deste grupo

  verticalPct: number | null
  horizontalDelta: number | null
  horizontalPct: number | null
}

// Resumo dos grupos não-DRE: existem fluxos mas não afetam o resultado.
export interface NonDREGroupResult {
  group: NonDREGroup
  groupLabel: string
  total: number
  transactionCount: number
}

export interface DRETotals {
  receitaBruta: number
  totalDeducoes: number
  receitaLiquida: number
  totalCustos: number                 // CUSTO_PRODUTO_VENDIDO
  lucroBruto: number
  totalOutrasReceitas: number
  totalDespesasPessoal: number        // separado pro destaque (academia)
  totalDespesasComerciais: number
  totalDespesasAdministrativas: number
  totalOutrasDespesas: number
  totalDespesasOperacionais: number   // pessoal + comerciais + admin + outras
  resultadoOperacional: number
  receitasFinanceiras: number
  despesasFinanceiras: number
  resultadoFinanceiro: number
  lair: number                        // Lucro Antes do IR
  impostosSobreLucro: number
  lucroLiquido: number

  // Margens (%)
  margemBruta: number          // Lucro Bruto / Receita Líquida
  margemOperacional: number    // Resultado Operacional / Receita Líquida
  margemLiquida: number        // Lucro Líquido / Receita Líquida
}

export interface DREResult {
  period: DREPeriod
  comparisonPeriod: DREPeriod | null

  groups: DREGroupResult[]
  totals: DRETotals

  // Lançamentos categorizados em grupos não-DRE (DISTRIBUICAO_LUCROS,
  // INVESTIMENTOS, TRANSFERENCIA). Existem mas não compõem o resultado.
  nonDreGroups: NonDREGroupResult[]

  // Transações sem categoria ou com dreGroup desconhecido (não entra em
  // nenhum grupo do DRE nem em non-DRE).
  uncategorized: {
    total: number
    transactionCount: number
  }

  // Análise horizontal sobre totais (vs comparison)
  totalsComparison: {
    receitaLiquidaDelta: number | null
    receitaLiquidaPct: number | null
    lucroLiquidoDelta: number | null
    lucroLiquidoPct: number | null
    margemLiquidaDelta: number | null  // pp (percentage points)
  }

  // Metadata
  metadata: {
    transactionsProcessed: number
    categoriesUsed: number
    calculatedAt: Date
  }
}
