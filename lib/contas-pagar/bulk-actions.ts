// Sprint 5.0.3.0b — Validação e helpers de bulk actions.
//
// Mark paid (em lote): rejeita se alguma das selecionadas JÁ foi efetivada
// com banco (bankAccountId preenchido E paymentDate). Razão: marcar paga
// novamente seria no-op ambíguo + perderia paymentDate original.
//
// Delete (em lote): permite tudo, com reversão de saldo nas efetivadas
// (lógica fica no endpoint usando lib/balance ou direct increment).

import { z } from 'zod'
import { TETO_DO_LOTE } from './selecao-do-filtro'

/**
 * ⛔⛔ 23/10 — **O TETO TEM UM DONO SÓ, E ELE É DERIVADO, nunca repetido.** Até hoje o `500`
 * vivia escrito **três vezes** (as duas ações aqui + `TETO_DO_LOTE`), e o comentário da lib
 * prometia que *"os dois são conferidos por teste"* — **esse teste não existia**.
 * ***Comentário que promete ser a trava sem ser a trava é pior que comentário nenhum*** (a
 * cicatriz de 08/10). Derivado, elevar um e esquecer o outro passou a ser **impossível**
 * (REGRA 5): a tela nunca mais oferece 800 ids pra uma rota que recusa 500.
 */

export const bulkActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('mark_paid'),
    transactionIds: z.array(z.string().cuid()).min(1).max(TETO_DO_LOTE),
    paymentDate: z.coerce.date(),
    // Sprint Caixa — conta usada pra pagar (opcional). Se preenchida:
    //   - tx é vinculada à conta (atualiza balance)
    //   - se CASH, valida saldo (não permite estourar)
    //   - sem mudança em "origin" — bulk usa origin existente (EXCEL/MANUAL)
    bankAccountId: z.string().cuid().optional().nullable(),
  }),
  z.object({
    action: z.literal('delete'),
    transactionIds: z.array(z.string().cuid()).min(1).max(TETO_DO_LOTE),
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
