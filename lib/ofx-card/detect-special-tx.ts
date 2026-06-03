// Sprint PF Fatia 3 — Detecção de transações especiais no MEMO.
//
// Casos reais do OFX Nubank Yussef:
//   "Pagamento recebido" → SKIP (não é gasto)
//   "Multa por fatura atrasada" → encargo
//   "IOF por fatura atrasada" → encargo
//   "IOF de compra internacional" → encargo + flag internacional
//   "Valor pendente do mês anterior" → rotativo (possível dup)
//   "Juros do rotativo" → encargo

export type SpecialTxKind =
  | 'INVOICE_PAYMENT'      // "Pagamento recebido" — NÃO importar
  | 'IOF_LATE'             // IOF atraso
  | 'IOF_INTL'             // IOF compra internacional
  | 'LATE_FEE'             // Multa atraso
  | 'CARRYOVER_PREVIOUS'   // "Valor pendente mês anterior" — rotativo
  | 'INTEREST_REVOLVING'   // Juros do rotativo
  | null                    // Compra normal

export interface SpecialTxDetection {
  kind: SpecialTxKind
  isInternational: boolean
  /** true → não importa essa tx (default só pra INVOICE_PAYMENT no MVP). */
  shouldSkipImport: boolean
  /** Categoria sugerida (nome da PersonalCategory padrão) */
  suggestedCategoryHint?: string
  /** Mensagem pra warn no preview */
  warnMessage?: string
}

const RE_INVOICE_PAYMENT = /pagamento\s+(recebido|efetuado)|^pagamento\s/i
const RE_LATE_FEE = /multa.*fatura|multa\s+por\s+atraso/i
const RE_IOF_INTL = /iof.*internacional|iof.*compra/i
const RE_IOF_LATE = /iof.*atraso|iof.*atrasada|iof.*fatura/i
const RE_IOF_GENERIC = /^iof\b/i
const RE_CARRYOVER = /valor\s+pendente.*(m[eê]s\s+anterior|anterior)|saldo\s+remanescente/i
const RE_INTEREST_REVOLVING = /juros\s+(do\s+)?rotativ|encargos\s+rotativ/i
const RE_INTERNATIONAL_TX = /compra\s+internacional|internacional|exterior/i

export function detectSpecialTx(
  memo: string,
  type: 'CREDIT' | 'DEBIT',
): SpecialTxDetection {
  const m = memo ?? ''

  // 1. Pagamento recebido (CREDIT) — SKIP no MVP
  if (type === 'CREDIT' && RE_INVOICE_PAYMENT.test(m)) {
    return {
      kind: 'INVOICE_PAYMENT',
      isInternational: false,
      shouldSkipImport: true,
      warnMessage: 'Pagamento da fatura detectado — não importado (não é compra)',
    }
  }

  // 2. Encargos (mais específico antes do genérico)
  if (RE_IOF_INTL.test(m)) {
    return {
      kind: 'IOF_INTL',
      isInternational: true,
      shouldSkipImport: false,
      suggestedCategoryHint: 'Cartão de crédito',
      warnMessage: 'IOF de compra internacional',
    }
  }
  if (RE_IOF_LATE.test(m)) {
    return {
      kind: 'IOF_LATE',
      isInternational: false,
      shouldSkipImport: false,
      suggestedCategoryHint: 'Cartão de crédito',
      warnMessage: 'IOF por atraso da fatura',
    }
  }
  if (RE_LATE_FEE.test(m)) {
    return {
      kind: 'LATE_FEE',
      isInternational: false,
      shouldSkipImport: false,
      suggestedCategoryHint: 'Cartão de crédito',
      warnMessage: 'Multa por atraso',
    }
  }
  if (RE_INTEREST_REVOLVING.test(m)) {
    return {
      kind: 'INTEREST_REVOLVING',
      isInternational: false,
      shouldSkipImport: false,
      suggestedCategoryHint: 'Cartão de crédito',
      warnMessage: 'Juros do rotativo',
    }
  }
  if (RE_CARRYOVER.test(m)) {
    return {
      kind: 'CARRYOVER_PREVIOUS',
      isInternational: false,
      shouldSkipImport: false,
      suggestedCategoryHint: 'Cartão de crédito',
      warnMessage: 'Valor pendente do mês anterior (rotativo) — verificar duplicação com fatura paga parcial',
    }
  }
  // IOF genérico (último caso)
  if (RE_IOF_GENERIC.test(m)) {
    return {
      kind: 'IOF_LATE',
      isInternational: false,
      shouldSkipImport: false,
      suggestedCategoryHint: 'Cartão de crédito',
    }
  }

  // 3. Detecta internacional (sem categoria especial — só flag)
  const isIntl = RE_INTERNATIONAL_TX.test(m)
  return {
    kind: null,
    isInternational: isIntl,
    shouldSkipImport: false,
  }
}
