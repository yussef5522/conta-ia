// Sprint Fundação Status (28/06/2026, modelo QuickBooks/Xero "For Review").
//
// FONTE DE VERDADE ÚNICA pra "tx precisa de revisão" (= aparecer na fila /pendentes).
// Antes cada endpoint reinventava o mesmo conjunto de guards — 6+ ocorrências
// divergiam sutilmente. Agora qualquer caller importa daqui.
//
// PRINCÍPIO: status NÃO entra no filtro de pendência. Pendência é sobre FALTA
// DE CLASSIFICAÇÃO (categoryId null + não é movimento técnico), não sobre o
// nome do estado. Regra inviolável da escada:
//   categoryId IS NULL  ⇒  status MUST BE 'PENDING'
//   categoryId IS NOT NULL ⇒  status MAY BE 'RECONCILED'
//
// 10 guards combinados via AND:
//   1. categoryId IS NULL          (sem categoria mesmo)
//   2. transferGroupId IS NULL     (não é transferência interna pareada)
//   3. reconciledWithId IS NULL    (não está conciliada via match — lado Excel→OFX)
//   4. reconciledFrom NONE         (ninguém aponta pra ela — lado OFX←Excel)
//   5. isCardPayment = false       (pagamento de cartão tem fila própria)
//   6. loanInstallmentPaid IS NULL (parcela casada — DRE conta só os juros)
//   7. pendingTransfer = false     (aguardando par — fila /transferencias)
//   8. isInternalTransfer = false  (transferência grupo conciliada — fora DRE)
//   9. ignoredAt IS NULL           (user marcou ignorar)
//   10. type != 'TRANSFER'         (defesa em profundidade)

/** Tipo bruto pro guard funcional (não-Prisma) */
export interface TxFlagsForReview {
  categoryId: string | null
  transferGroupId: string | null
  reconciledWithId: string | null
  /** true = pelo menos 1 tx aponta esta como reconciledWithId */
  hasReconciledFrom: boolean
  isCardPayment: boolean
  /** true = tem LoanInstallment.reconciledTransactionId = tx.id */
  hasLoanInstallment: boolean
  pendingTransfer: boolean
  isInternalTransfer: boolean
  ignoredAt: Date | null
  type: 'CREDIT' | 'DEBIT' | 'TRANSFER' | string
}

/**
 * Determina se uma tx ENTRA na fila "pra revisar" (= /pendentes).
 *
 * Função PURA — qualquer caller que carrega esses 10 campos pode chamar.
 * Status NÃO é input: 1 tx PENDING+categoryId='abc' NÃO precisa revisão.
 * 1 tx RECONCILED+categoryId=null (estado inconsistente) PRECISA — backfill
 * coloca em PENDING via fase paralela.
 */
export function needsReview(tx: TxFlagsForReview): boolean {
  return (
    tx.categoryId === null &&
    tx.transferGroupId === null &&
    tx.reconciledWithId === null &&
    !tx.hasReconciledFrom &&
    !tx.isCardPayment &&
    !tx.hasLoanInstallment &&
    !tx.pendingTransfer &&
    !tx.isInternalTransfer &&
    tx.ignoredAt === null &&
    tx.type !== 'TRANSFER'
  )
}

/**
 * MESMO conjunto em formato Prisma WHERE — pra reuso em queries SQL.
 *
 * Composer com outros filtros (companyId, date, etc):
 *   where: { ...NEEDS_REVIEW_WHERE_PRISMA, bankAccount: { companyId }, date: { gte, lte } }
 *
 * NÃO inclui status — by design.
 */
export const NEEDS_REVIEW_WHERE_PRISMA = {
  categoryId: null,
  transferGroupId: null,
  reconciledWithId: null,
  reconciledFrom: { none: {} },
  isCardPayment: false,
  loanInstallmentPaid: { is: null },
  pendingTransfer: false,
  isInternalTransfer: false,
  ignoredAt: null,
  type: { not: 'TRANSFER' as const },
} as const

/**
 * Regra da escada de status. Use SEMPRE ao criar/atualizar uma tx:
 *
 *   prisma.transaction.create({ data: { ..., status: statusFromCategoryId(categoryId) } })
 *
 * Garante: categoryId null ⇒ status 'PENDING'. Categorizar (manual/regra) ⇒ 'RECONCILED'.
 */
export function statusFromCategoryId(
  categoryId: string | null | undefined,
): 'PENDING' | 'RECONCILED' {
  return categoryId ? 'RECONCILED' : 'PENDING'
}

/**
 * Sprint Category-Combobox (29/06/2026) — DEFESA EM PROFUNDIDADE.
 *
 * Recalcula status no FIM de qualquer create/update pra GARANTIR a invariante
 * da escada, independente do que o caller mande no body. Resolve a armadilha
 * lateral descoberta no diagnóstico: PUT /api/transacoes/[id] aceitava body
 * `{ categoryId: X, status: 'PENDING' }` e o spread `data.status` sobrescrevia
 * o status calculado pelo helper, recriando estado invertido.
 *
 * Política:
 * - IGNORED é independente (estado manual, preservado).
 * - CASH (conta caixa físico) é sempre RECONCILED (sem extrato pra conciliar).
 * - Resto: deriva de categoryId via statusFromCategoryId (escada inviolável).
 *
 * Idempotente: chamar 2x retorna o mesmo valor.
 */
export interface StatusContext {
  /** Status que o caller pretendia gravar (ou status atual da tx). */
  intendedStatus?: 'PENDING' | 'RECONCILED' | 'IGNORED' | null
  /** categoryId que vai entrar na tx (após o update). */
  categoryId: string | null | undefined
  /** accountType da bankAccount linkada. CASH → sempre RECONCILED. */
  accountType?: string | null
}

export function enforceStatusLadder(
  ctx: StatusContext,
): 'PENDING' | 'RECONCILED' | 'IGNORED' {
  // (0) IGNORED é manual, independe da escada.
  if (ctx.intendedStatus === 'IGNORED') return 'IGNORED'

  // (1) CASH não tem extrato OFX → nasce/permanece RECONCILED.
  if (ctx.accountType === 'CASH') return 'RECONCILED'

  // (2) Escada: categoria decide.
  return statusFromCategoryId(ctx.categoryId)
}
