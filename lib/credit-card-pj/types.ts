// Sprint Cartao Credito PJ (24/06/2026)

/** Tipo de linha da fatura sugerido pela IA */
export type InvoiceLineKind =
  | 'COMPRA_AVISTA'           // FACEBK, NETFLIX, IFOOD -> DESPESA categorizada
  | 'COMPRA_PARCELADA'        // "MERCADOLIVRE 08/12" -> so parcela do mes (regime caixa)
  | 'ENCARGO_FINANCEIRO'      // JUROS ROTATIVO, MULTA, MORA, IOF -> Despesa Financeira
  | 'IGNORAR'                 // FATURA ANTERIOR, OBRIGADO, CASHBACK, AJUSTE, estorno -> NAO entra

export interface InvoiceLine {
  /** ISO date YYYY-MM-DD */
  date: string
  description: string
  /** Valor absoluto positivo (R$) */
  amount: number
  /** Tipo sugerido pela IA */
  suggestedKind: InvoiceLineKind
  /** Numero da parcela quando COMPRA_PARCELADA (1..N) */
  installmentNumber?: number
  installmentTotal?: number
  /** Final do cartao (quando ha multiplos cartoes na fatura) */
  cardLastDigits?: string
  /** True quando a IA marca como linha duvidosa pro user verificar */
  needsReview?: boolean
  /** Nota livre da IA pro user (ex: "valor pequeno - verifique") */
  note?: string
  /**
   * Sprint Cartao R2 (24/06/2026) — categoria sugerida pelo Claude
   * em PT-BR. Pode bater literal com nome de categoria EXPENSE da empresa,
   * fuzzy match aproximado, ou ser omisso quando IA nao tem certeza.
   */
  suggestedCategoryName?: string
}

export interface InvoiceExtraction {
  /** Vencimento da fatura (YYYY-MM-DD) — null se ausente */
  dueDate: string | null
  /** Data de fechamento — null se ausente */
  closingDate: string | null
  /** Total de gastos declarado no PERIODO (compras + encargos) — null se ausente */
  totalDeclared: number | null
  /**
   * Sprint Cartao R3 (24/06/2026) — VALOR A PAGAR / saldo devedor da fatura.
   * Eh o que VAI SAIR DO BANCO. Pode incluir saldo anterior, descontar
   * creditos, etc. Usado pra casar com pagamento existente no extrato.
   * Quando null, fallback pra totalDeclared.
   */
  totalToPay: number | null
  /** Limite total do cartao declarado na fatura (R$) — null se ausente */
  creditLimit: number | null
  /** Limite disponivel apos fatura (R$) — null se ausente */
  availableLimit: number | null
  /** Banco/emissor detectado (Caixa, Banrisul, Sicredi, etc) */
  detectedBank: string | null
  /** Finais de cartoes encontrados na fatura ["2937","3883"] */
  cardLastDigitsFound: string[]
  /** Qualidade do scan reportada pela IA */
  scanQuality: 'GOOD' | 'FAIR' | 'POOR' | 'UNKNOWN'
  /** Linhas extraidas */
  lines: InvoiceLine[]
  /** Mensagens livres da IA */
  notes: string[]
}

export class CreditCardPjExtractError extends Error {
  constructor(
    public code:
      | 'NO_FILE'
      | 'FILE_TOO_LARGE'
      | 'NOT_A_PDF'
      | 'ENCRYPTED_PDF'
      | 'ANTHROPIC_API_KEY_MISSING'
      | 'CLAUDE_TIMEOUT'
      | 'CLAUDE_API_ERROR'
      | 'CLAUDE_INVALID_JSON'
      | 'VALIDATION_FAILED'
      | 'GATE_DISABLED',
    message: string,
    public details?: unknown,
  ) {
    super(message)
    this.name = 'CreditCardPjExtractError'
  }
}
