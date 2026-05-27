// Sprint 5.0.3.0b — Validação e helpers de bulk actions.
//
// Mark paid (em lote): rejeita se alguma das selecionadas JÁ foi efetivada
// com banco (bankAccountId preenchido E paymentDate). Razão: marcar paga
// novamente seria no-op ambíguo + perderia paymentDate original.
//
// Delete (em lote): permite tudo, com reversão de saldo nas efetivadas
// (lógica fica no endpoint usando lib/balance ou direct increment).

import { z } from 'zod'

export const bulkActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('mark_paid'),
    transactionIds: z.array(z.string().cuid()).min(1).max(500),
    paymentDate: z.coerce.date(),
  }),
  z.object({
    action: z.literal('delete'),
    transactionIds: z.array(z.string().cuid()).min(1).max(500),
  }),
])

export type BulkActionInput = z.infer<typeof bulkActionSchema>

export interface BulkInputTx {
  id: string
  bankAccountId: string | null
  paymentDate: Date | string | null
}

export interface BulkValidationResult {
  allowed: string[]
  blocked: string[]
}

/**
 * Mark paid: rejeita IDs que já tem bankAccountId + paymentDate.
 *
 * Caller (endpoint) deve retornar 422 com `blockedTransactionIds` quando
 * blocked.length > 0 — não permite execução parcial (semântica all-or-none
 * da spec 5.0.3.0b).
 */
export function validateBulkMarkPaid(
  txs: BulkInputTx[],
): BulkValidationResult {
  const allowed: string[] = []
  const blocked: string[] = []
  for (const tx of txs) {
    if (tx.bankAccountId && tx.paymentDate) {
      blocked.push(tx.id)
    } else {
      allowed.push(tx.id)
    }
  }
  return { allowed, blocked }
}

/**
 * Mensagem humana pra "X das N contas já foram efetivadas".
 * Usada no `message` do JSON de erro 422.
 */
export function blockedMessage(blockedCount: number, totalCount: number): string {
  if (blockedCount === 0) return ''
  if (blockedCount === totalCount) {
    return `Todas as ${totalCount} contas já foram efetivadas com banco. Desmarque-as ou use "Desfazer efetivação" antes.`
  }
  return `${blockedCount} de ${totalCount} contas já foram efetivadas com banco. Desmarque-as antes de prosseguir.`
}
