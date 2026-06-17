// Sprint 4.0.1.a — Foundation Core Financeiro AP/AR.
//
// Distingue o ESTADO de um lançamento financeiro:
//   - EFFECTED   = transação real que já aconteceu (OFX importado, pagamento manual feito).
//                   Hoje (pré-Sprint 4.0.1) TODAS as transações são EFFECTED.
//   - PAYABLE    = conta a pagar (compromisso futuro, ainda não saiu do caixa).
//                   Vira EFFECTED quando efetivada (pagamento manual) ou conciliada (OFX bate).
//   - RECEIVABLE = conta a receber (esperando dinheiro entrar).
//                   Vira EFFECTED quando efetivada (recebimento manual) ou conciliada (OFX bate).
//
// O campo `status` (PENDING/RECONCILED/IGNORED) é ORTOGONAL: representa o estado de
// classificação IA / conciliação bancária. Lifecycle representa o estado FINANCEIRO.

export type Lifecycle = 'EFFECTED' | 'PAYABLE' | 'RECEIVABLE'

export const LIFECYCLES: readonly Lifecycle[] = ['EFFECTED', 'PAYABLE', 'RECEIVABLE'] as const

// Transições válidas. Setadas conservadoramente:
//   - PAYABLE/RECEIVABLE → EFFECTED (via efetivação manual ou conciliação OFX)
//   - EFFECTED é terminal (não retorna pra PAYABLE; user deve criar tx nova se errou)
export const LIFECYCLE_TRANSITIONS: Record<Lifecycle, readonly Lifecycle[]> = {
  PAYABLE: ['EFFECTED'],
  RECEIVABLE: ['EFFECTED'],
  EFFECTED: [],
}

export function isLifecycle(value: unknown): value is Lifecycle {
  return typeof value === 'string' && (LIFECYCLES as readonly string[]).includes(value)
}

export function canTransition(from: Lifecycle, to: Lifecycle): boolean {
  if (from === to) return false // transição pra si mesmo não conta
  return LIFECYCLE_TRANSITIONS[from].includes(to)
}

// Erro semântico — pode virar HTTP 422 no API layer.
export class LifecycleValidationError extends Error {
  constructor(public readonly reason: string) {
    super(reason)
    this.name = 'LifecycleValidationError'
  }
}

export interface LifecycleStateInput {
  lifecycle: Lifecycle
  status: 'PENDING' | 'RECONCILED' | 'IGNORED' | string
  paymentDate: Date | string | null | undefined
  dueDate: Date | string | null | undefined
  bankAccountId: string | null | undefined
  /**
   * Sprint Trava-Permanente (16/06/2026) — regra 5.
   * Cash-coded = despesa em dinheiro físico, sem extrato bancário pra conciliar.
   * Default false quando omitido.
   */
  cashCoded?: boolean | null | undefined
  /**
   * Sprint Trava-Permanente — regra 5.
   * Quando a tx foi conciliada com outra (par OFX), reconciledWithId aponta pra
   * tx-par que tem o banco. Estado legítimo: Excel cadastrada como PAYABLE+sem-bank,
   * depois conciliada com OFX-par → vira EFFECTED mas bankAccountId continua null.
   */
  reconciledWithId?: string | null | undefined
}

export interface ValidationResult {
  valid: boolean
  error?: string
}

/**
 * Valida coerência entre lifecycle e campos relacionados.
 *
 * Regras:
 *   1. PAYABLE/RECEIVABLE NÃO podem ter paymentDate (não foi pago ainda).
 *   2. PAYABLE/RECEIVABLE DEVEM ter dueDate (precisa saber quando vence).
 *   3. EFFECTED com paymentDate=null é OK (regime competência sem pagamento ainda).
 *   4. bankAccountId pode ser null em PAYABLE/RECEIVABLE (user nem sabe ainda).
 *   5. Sprint Trava-Permanente (16/06/2026): EFFECTED exige ≥1 de:
 *      (a) bankAccountId NOT NULL — banco próprio da tx, OU
 *      (b) cashCoded=true       — despesa em dinheiro físico (caixa, sem extrato), OU
 *      (c) reconciledWithId NOT NULL — conciliada com OFX-par (par tem banco).
 *      Estado proibido: EFFECTED + bankAccountId NULL + cashCoded NÃO true +
 *      reconciledWithId NULL = órfão silencioso que vaza no Find & Match.
 */
export function validateLifecycleState(input: LifecycleStateInput): ValidationResult {
  if (!isLifecycle(input.lifecycle)) {
    return { valid: false, error: `lifecycle inválido: ${input.lifecycle}` }
  }

  const isPending = input.lifecycle === 'PAYABLE' || input.lifecycle === 'RECEIVABLE'

  if (isPending) {
    if (input.paymentDate !== null && input.paymentDate !== undefined) {
      return {
        valid: false,
        error: `${input.lifecycle} não pode ter paymentDate (não foi pago/recebido ainda)`,
      }
    }
    if (input.dueDate === null || input.dueDate === undefined) {
      return {
        valid: false,
        error: `${input.lifecycle} requer dueDate (data esperada de pagamento/recebimento)`,
      }
    }
  }

  // Regra 5 — trava do EFFECTED órfão (Sprint Trava-Permanente)
  if (input.lifecycle === 'EFFECTED') {
    const hasBank = input.bankAccountId !== null && input.bankAccountId !== undefined && input.bankAccountId !== ''
    const isCashCoded = input.cashCoded === true
    const hasReconcile =
      input.reconciledWithId !== null && input.reconciledWithId !== undefined && input.reconciledWithId !== ''
    if (!hasBank && !isCashCoded && !hasReconcile) {
      return {
        valid: false,
        error:
          'EFFECTED exige bankAccountId, cashCoded=true OU reconciledWithId. ' +
          'Não crie EFFECTED órfão sem banco e sem cash-coding (vaza no Find & Match).',
      }
    }
  }

  return { valid: true }
}

/**
 * Calcula `type` (CREDIT/DEBIT) implícito pelo lifecycle.
 *   - PAYABLE → DEBIT (saída futura)
 *   - RECEIVABLE → CREDIT (entrada futura)
 *   - EFFECTED → null (depende do contexto, caller decide)
 */
export function defaultTypeFromLifecycle(lifecycle: Lifecycle): 'CREDIT' | 'DEBIT' | null {
  if (lifecycle === 'PAYABLE') return 'DEBIT'
  if (lifecycle === 'RECEIVABLE') return 'CREDIT'
  return null
}

/**
 * Marca lifecycle como EFFECTED (efetivação manual ou conciliação).
 * Retorna o patch a ser aplicado via prisma.transaction.update.
 */
export interface EffectivePatch {
  lifecycle: 'EFFECTED'
  paymentDate: Date
  bankAccountId: string
  status: string
}

export function buildEffectivePatch(
  paymentDate: Date,
  bankAccountId: string,
  options: { markReconciled?: boolean } = {},
): EffectivePatch {
  if (!bankAccountId) {
    throw new LifecycleValidationError('bankAccountId obrigatório na efetivação')
  }
  if (!(paymentDate instanceof Date) || isNaN(paymentDate.getTime())) {
    throw new LifecycleValidationError('paymentDate inválido')
  }
  return {
    lifecycle: 'EFFECTED',
    paymentDate,
    bankAccountId,
    status: options.markReconciled ? 'RECONCILED' : 'PENDING',
  }
}
