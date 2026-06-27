// Sprint OFX V3 Premium — tipos do pipe declarativo "marcacoes".

/**
 * Tipo decidido pelo user no preview da tx OFX.
 *   RECEITA           — entrada de dinheiro com categoria (cash-code CREDIT)
 *   DESPESA           — saída com categoria (cash-code DEBIT)
 *   TRANSFER          — transferência entre contas próprias (com ou sem par)
 *   PAGAMENTO_CARTAO  — paga fatura de cartão (vincula ao cartão)
 *   PAGAMENTO_EMPRESTIMO — paga parcela de empréstimo (vincula à parcela)
 *   IGNORAR           — não cria a tx (gravado como tombstone no seen-ledger)
 */
export type OfxLineKind =
  | 'RECEITA'
  | 'DESPESA'
  | 'TRANSFER'
  | 'PAGAMENTO_CARTAO'
  | 'PAGAMENTO_EMPRESTIMO'
  | 'IGNORAR'

export interface OfxLineMarkParams {
  /** Para RECEITA/DESPESA: categoria + supplier/customer/regra opcionais */
  categoryId?: string | null
  supplierId?: string | null
  customerId?: string | null
  criarRegra?: boolean
  /** Para PAGAMENTO_CARTAO */
  cardId?: string | null
  /** Para PAGAMENTO_EMPRESTIMO */
  loanId?: string | null
  installmentNumber?: number | null
}

export interface OfxLineMark {
  /** ID da transaction (criada pelo confirm OFX antes do apply-marks) */
  transactionId: string
  kind: OfxLineKind
  params?: OfxLineMarkParams
}

export interface OfxApplyMarksResult {
  applied: number
  skipped: number
  /** Por transactionId, o motivo do erro (se houver) */
  failed: Array<{ transactionId: string; kind: OfxLineKind; error: string }>
}

/**
 * Confiança da sugestão da IA por linha (selo visual).
 *   ALTA   — verde: 'tenho certeza'
 *   MEDIA  — âmbar: 'confira'
 *   BAIXA  — sem selo: 'escolha você'
 *   AGUARDA_PAR — azul: 'transferência sem par ainda'
 */
export type AiSuggestionConfidence = 'ALTA' | 'MEDIA' | 'BAIXA' | 'AGUARDA_PAR'

export interface AiSuggestion {
  suggestedKind: OfxLineKind | null
  confidence: AiSuggestionConfidence
  /** Explicação curta em PT-BR (1 linha) */
  reason: string
  /** Sugestão de categoria (pra RECEITA/DESPESA) */
  suggestedCategoryId?: string | null
  /** Sugestão de cartão (pra PAGAMENTO_CARTAO) */
  suggestedCardId?: string | null
  /** Sugestão de empréstimo + parcela (pra PAGAMENTO_EMPRESTIMO) */
  suggestedLoanId?: string | null
  suggestedInstallmentNumber?: number | null
}
