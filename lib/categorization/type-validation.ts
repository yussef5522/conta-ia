// Sprint 5.0.2.t — Validação tipo categoria × tipo transação.
//
// REGRA CONTÁBIL:
//   - tx.type === 'CREDIT' (entrada de $) ⟺ category.type ∈ {INCOME, TRANSFER}
//   - tx.type === 'DEBIT'  (saída  de $) ⟺ category.type ∈ {EXPENSE, TRANSFER}
//
// "Receita Pix" (category.type=INCOME) NUNCA deve ser sugerida pra tx DEBIT.
// "Matéria-Prima" (category.type=EXPENSE) NUNCA deve ser sugerida pra tx CREDIT.
//
// FUNÇÃO PURA: sem DB, sem deps externas. Testável trivialmente.

export type TxType = 'CREDIT' | 'DEBIT' | 'TRANSFER' | string
export type CategoryType = 'INCOME' | 'EXPENSE' | 'TRANSFER' | string

/**
 * Retorna true se a categoria é compatível com o tipo da transação.
 *
 * - TRANSFER (categoria) sempre compatível (lados pareados em transferência).
 * - TRANSFER (tx) só aceita categoria TRANSFER.
 * - CREDIT (entrada $) → INCOME ou TRANSFER.
 * - DEBIT (saída $) → EXPENSE ou TRANSFER.
 *
 * Quando categoryType é null/undefined (categoria órfã legado), tratamos
 * como `compatível` pra não bloquear migração — caller deve checar via UI.
 */
export function isCategoryCompatibleWithTxType(
  categoryType: CategoryType | null | undefined,
  txType: TxType,
): boolean {
  if (!categoryType) return true // legado/órfã — não bloqueia

  if (categoryType === 'TRANSFER') return true

  if (txType === 'TRANSFER') return categoryType === 'TRANSFER'

  if (txType === 'CREDIT') return categoryType === 'INCOME'
  if (txType === 'DEBIT') return categoryType === 'EXPENSE'

  // Tipos desconhecidos: não bloqueia
  return true
}

/**
 * Helper pra Vendor Discovery: mapeia tx.type → tipoTransacao do cache.
 */
export function expectedCacheTipoTransacao(
  txType: TxType,
): 'INCOME' | 'EXPENSE' | 'ANY' {
  if (txType === 'CREDIT') return 'INCOME'
  if (txType === 'DEBIT') return 'EXPENSE'
  return 'ANY'
}

/**
 * Helper pra cache lookup: ANY é compatível com qualquer; senão precisa bater.
 */
export function isCacheTipoCompatible(
  cacheTipo: 'INCOME' | 'EXPENSE' | 'ANY' | string,
  txType: TxType,
): boolean {
  if (cacheTipo === 'ANY') return true
  return cacheTipo === expectedCacheTipoTransacao(txType)
}
