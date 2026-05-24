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
 *   5. EFFECTED criada via OFX DEVE ter bankAccountId (não há OFX sem conta).
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
