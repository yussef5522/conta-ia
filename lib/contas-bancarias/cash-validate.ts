// Sprint Caixa — Validação de Conta Caixa (accountType=CASH).
//
// PRINCÍPIO CONTÁBIL: Caixa físico NUNCA pode ficar negativo (não dá pra
// pagar mais dinheiro do que tem na gaveta). Trava obrigatória.
//
// FORÇA estes valores no save (cria/edita):
//   - allowNegativeBalance = false (sempre)
//   - creditLimit          = 0     (sempre)
//   - bankName/bankCode/agency/accountNumber = null (sem banco)
//   - pluggyItemId/pluggyAccountId           = null (sem Open Finance)
//
// REJEITA na app-layer (não confiar só em UI):
//   - allowNegativeBalance=true em CASH → CashValidationError
//   - creditLimit > 0 em CASH → CashValidationError
//
// FUNÇÃO PURA — sem DB, testável.

export const CASH_KIND_VALUES = ['MAIN', 'PETTY', 'PDV_TERMINAL'] as const
export type CashKind = (typeof CASH_KIND_VALUES)[number]

export const ACCOUNT_TYPES = ['CHECKING', 'SAVINGS', 'CASH'] as const
export type AccountType = (typeof ACCOUNT_TYPES)[number]

export class CashValidationError extends Error {
  status = 400
  constructor(message: string, readonly code: string) {
    super(message)
    this.name = 'CashValidationError'
  }
}

export interface CashSafeInput {
  accountType: string
  allowNegativeBalance: boolean
  creditLimit: number
  cashKind: string | null
  bankName?: string | null
  bankCode?: string | null
  agency?: string | null
  accountNumber?: string | null
  pluggyItemId?: string | null
  pluggyAccountId?: string | null
  lowBalanceThreshold?: number | null
}

/**
 * Valida input e normaliza pra CASH. Se accountType !== CASH, retorna
 * o input intocado (caller decide). Se CASH, FORÇA os defaults seguros.
 */
export function normalizeAndValidateCashAccount<T extends CashSafeInput>(
  input: T,
): T {
  if (input.accountType !== 'CASH') {
    // Conta bancária: rejeita cashKind preenchido (não pertence)
    if (input.cashKind) {
      throw new CashValidationError(
        'cashKind só pode ser preenchido em contas accountType=CASH',
        'CASH_KIND_ONLY_FOR_CASH',
      )
    }
    return input
  }

  // accountType === 'CASH'
  // Trava obrigatória: nunca aceitar negativo
  if (input.allowNegativeBalance === true) {
    throw new CashValidationError(
      'Conta Caixa não pode permitir saldo negativo (regra contábil)',
      'CASH_CANNOT_BE_NEGATIVE',
    )
  }
  if (input.creditLimit > 0) {
    throw new CashValidationError(
      'Conta Caixa não tem cheque especial (creditLimit deve ser 0)',
      'CASH_NO_CREDIT_LIMIT',
    )
  }

  // cashKind opcional. Se preenchido, precisa ser válido.
  if (input.cashKind && !CASH_KIND_VALUES.includes(input.cashKind as CashKind)) {
    throw new CashValidationError(
      `cashKind inválido. Use: ${CASH_KIND_VALUES.join(', ')}`,
      'CASH_KIND_INVALID',
    )
  }

  // Normaliza campos bancários (caixa não tem banco)
  return {
    ...input,
    allowNegativeBalance: false,
    creditLimit: 0,
    cashKind: input.cashKind ?? 'MAIN',
    bankName: null,
    bankCode: null,
    agency: null,
    accountNumber: null,
    pluggyItemId: null,
    pluggyAccountId: null,
  }
}

export function isCashAccount(accountType: string | null | undefined): boolean {
  return accountType === 'CASH'
}
