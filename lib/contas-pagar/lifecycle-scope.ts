// Bug-fix 28/05/2026 — Helper de escopo "Contas a Pagar".
//
// Após o backfill que transicionou 492 contas PAYABLE+paymentDate → EFFECTED,
// as rotas de edit/delete/duplicar/inline precisam aceitar AMBOS os lifecycles
// pra manter UX consistente com a listagem (lib/contas-pagar/list-filters.ts).
//
// Critério de "está no escopo Contas a Pagar":
//   - lifecycle === 'PAYABLE'           — conta pendente
//   - lifecycle === 'EFFECTED' AND:
//     - dueDate IS NOT NULL             — nasceu como conta a pagar
//     - type === 'DEBIT'                — é despesa
//     - reconciledWithId === null       — não foi conciliada com OFX (essa
//                                          pertence ao escopo de movimentações)
//
// REGRA DE PRODUTO: edit/delete/duplicar de uma EFFECTED-paga muda o DRE
// histórico do mês — caller deve assumir a responsabilidade. UI pode mostrar
// confirmação extra ao editar conta paga (não escopo desta lib).

export interface MaybePayable {
  lifecycle: string
  dueDate: Date | null
  type: string
  reconciledWithId: string | null
}

export function isInPayableScope(tx: MaybePayable): boolean {
  if (tx.lifecycle === 'PAYABLE') return true
  if (tx.lifecycle === 'EFFECTED') {
    return (
      tx.dueDate !== null &&
      tx.type === 'DEBIT' &&
      tx.reconciledWithId === null
    )
  }
  return false
}

/** Mensagem padrão pra rejeições */
export const NOT_PAYABLE_ERROR = {
  erro: 'Conta fora do escopo de "Contas a Pagar"',
  code: 'NOT_PAYABLE_SCOPE',
} as const
