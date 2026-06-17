// Sprint CSV Import (30/05/2026) — Decide lifecycle pra linha CACULA.
//
// 🚨 PROTEÇÃO CRÍTICA — BUG HISTÓRICO R$ 939k:
//   Em 27-28/05/2026 o bug de import Excel criava PAYABLE+paymentDate
//   inválido pra 492 contas (R$ 939k em profit sao borja + cacula mix),
//   ficando invisíveis em todos os relatórios. A correção foi adotar
//   `lib/lifecycle/index.ts:validateLifecycleState` que IMPEDE esse
//   estado inválido. Esta lib reusa exatamente essa validação.
//
// REGRA DETERMINÍSTICA (decisão Yussef):
//   STATUS=PAGO + paymentDate preenchida → EFFECTED
//   STATUS=PAGO + paymentDate=null (edge "PAGO órfão") → PAYABLE defensivo
//                + flag pra preview "STATUS PAGO sem data — revisar"
//   STATUS qualquer outro (VENCE HOJE, VENCIDO, etc) → PAYABLE
//
// SEMPRE valida via validateLifecycleState antes de retornar.
// Se a validação reprovar (bug do mapper), joga erro — caller decide.

import {
  validateLifecycleState,
  type Lifecycle,
} from '@/lib/lifecycle'

export interface LifecycleDecisionInput {
  status: string | null | undefined
  paymentDate: Date | null
  dueDate: Date | null
}

export interface LifecycleDecisionResult {
  lifecycle: Lifecycle
  /**
   * Razão da decisão (auditável + mostrável no preview UI).
   * Especialmente útil pra edge "PAGO órfão" — Yussef sabe que
   * tem que revisar.
   */
  reason:
    | 'PAGO_COM_DATA_PAGAMENTO'
    | 'PAGO_SEM_DATA_PAGAMENTO_DEFENSIVO'
    | 'NAO_PAGO_VENCE_HOJE'
    | 'NAO_PAGO_VENCIDO'
    | 'NAO_PAGO_OUTRO'
  /**
   * True se o user PRECISA revisar (edge case detectado).
   * Preview UI mostra badge ⚠️.
   */
  precisaRevisar: boolean
  /** Texto curto pra badge no preview */
  motivoRevisar?: string
  /** paymentDate final que será gravada (pode ser sobrescrita pra null defensivo) */
  paymentDateFinal: Date | null
}

const STATUS_PAGO = 'PAGO'

export function decidirLifecycleCacula(
  input: LifecycleDecisionInput,
): LifecycleDecisionResult {
  const statusNorm = (input.status ?? '').toString().toUpperCase().trim()
  const pago = statusNorm === STATUS_PAGO
  const temPaymentDate = input.paymentDate !== null

  let lifecycle: Lifecycle
  let reason: LifecycleDecisionResult['reason']
  let paymentDateFinal: Date | null
  let precisaRevisar = false
  let motivoRevisar: string | undefined

  if (pago && temPaymentDate) {
    lifecycle = 'EFFECTED'
    reason = 'PAGO_COM_DATA_PAGAMENTO'
    paymentDateFinal = input.paymentDate
  } else if (pago && !temPaymentDate) {
    // 🚨 EDGE defensivo: STATUS=PAGO mas sem data de pagamento.
    // Em vez de criar EFFECTED órfão (estado fraco/incoerente),
    // marcamos PAYABLE com badge pra Yussef revisar.
    lifecycle = 'PAYABLE'
    reason = 'PAGO_SEM_DATA_PAGAMENTO_DEFENSIVO'
    paymentDateFinal = null // garante consistência com PAYABLE
    precisaRevisar = true
    motivoRevisar = 'STATUS PAGO sem data de pagamento — revisar'
  } else if (statusNorm === 'VENCE HOJE') {
    lifecycle = 'PAYABLE'
    reason = 'NAO_PAGO_VENCE_HOJE'
    paymentDateFinal = null
  } else if (statusNorm === 'VENCIDO') {
    lifecycle = 'PAYABLE'
    reason = 'NAO_PAGO_VENCIDO'
    paymentDateFinal = null
  } else {
    lifecycle = 'PAYABLE'
    reason = 'NAO_PAGO_OUTRO'
    paymentDateFinal = null
  }

  // 🛡 VALIDAÇÃO FINAL — guarda contra bug R$ 939k.
  // Se cair aqui, é bug no mapper acima. NUNCA deve gravar estado inválido.
  //
  // Sprint Trava-Permanente (16/06/2026): pra cumprir regra 5, EFFECTED órfão
  // do CACULA (sem bank) vira cash-coded no confirm — espelhamos aqui pra
  // validar o estado FINAL que será gravado.
  const validation = validateLifecycleState({
    lifecycle,
    status: 'PENDING', // status do Transaction (PENDING/RECONCILED) é ortogonal
    paymentDate: paymentDateFinal,
    dueDate: input.dueDate,
    bankAccountId: null, // CACULA não traz conta; nullable em PAYABLE
    cashCoded: lifecycle === 'EFFECTED', // confirm Excel marca true em EFFECTED órfão
  })
  if (!validation.valid) {
    throw new Error(
      `decidirLifecycleCacula gerou estado inválido: ${validation.error}. ` +
        `Input: status="${input.status}", paymentDate=${input.paymentDate?.toISOString() ?? 'null'}, ` +
        `dueDate=${input.dueDate?.toISOString() ?? 'null'}`,
    )
  }

  return {
    lifecycle,
    reason,
    paymentDateFinal,
    precisaRevisar,
    motivoRevisar,
  }
}
