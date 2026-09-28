import type { Prisma } from '@prisma/client'
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
export const NEEDS_REVIEW_WHERE_PRISMA: Prisma.TransactionWhereInput = {
  categoryId: null,
  transferGroupId: null,
  reconciledWithId: null,
  reconciledFrom: { none: {} },
  /**
   * ⭐⭐ 27/09 — **O VÍNCULO, não a flag.** Era `isCardPayment: false`, e isso **escondia da
   * fila** a linha que tem a flag da heurística e **nenhum vínculo** — ela saía da fila sem
   * estar resolvida, e o gesto que a resolveria ficava inalcançável (o Carter de 20/09: fatura
   * OPEN com o pagamento dela no extrato, o K3 gritando e nenhuma tela onde agir).
   *
   * ⚠️ Medido antes de trocar: **0 linhas** com a flag sem vínculo na Caçula — o número da fila
   * não se move hoje; o que muda é a porta sem maçaneta deixar de ser possível.
   */
  /**
   * ⚠️⚠️ **AQUI EU ERREI E MEDI ANTES DE O DONO VER.** A 1ª versão do fix escreveu
   * `businessCreditCardId: null`, que exclui **TODA linha de cartão — inclusive as COMPRAS**,
   * que são justamente as que esperam a palavra do dono. A régua antiga (`isCardPayment:
   * false`) mantinha as compras na fila; eu a estreitei sem querer.
   *
   * ⭐ Medido em prod na hora: **0 compras de cartão sem categoria** na Caçula hoje, então
   * nada sumiu de fato — mas a **próxima fatura importada** teria compras invisíveis. *Defeito
   * latente medido é defeito consertado; latente não medido é o que volta em três meses.*
   *
   * ⭐ O que sai da fila é o **PAGAMENTO com vínculo** (que é o que o gesto 💳 resolve), nunca
   * a compra — a mesma condição do `seloDoSistema`: `isCardPayment && faturaVinculada`.
   */
  NOT: { AND: [{ isCardPayment: true }, { businessCreditCardId: { not: null } }] },
  loanInstallmentPaid: { is: null },
  // Sprint Casar Pagamento (04/08/2026): tx vinculada a parcela via ponte N:1
  // (débito parcial de empréstimo) SAI da fila — o split é do empréstimo, não
  // categoria da tx. Espelha o loanInstallmentPaid (1:1).
  loanInstallmentPayments: { none: {} },
  /**
   * ⭐ 27/09 — **APORTE e LIBERAÇÃO entram na lista.** Eram as duas famílias de vínculo que
   * ninguém tinha acrescentado aqui: o aporte nasceu em 25/09 e a liberação em 26/08, e as
   * duas são resolvidas pelo vínculo (o DRE as trata por `nonDreGroups` e por `loanDisbursement`).
   * ⚠️ Lista de exclusão que envelhece é o que faz a fila cobrar o que já foi decidido.
   */
  investmentContribution: { is: null },
  loanDisbursement: { is: null },
  pendingTransfer: false,
  isInternalTransfer: false,
  ignoredAt: null,
  type: { not: 'TRANSFER' as const },
  /**
   * ⚠️ **Tipado como `TransactionWhereInput` em vez de `as const` (27/09):** o `NOT` acima
   * precisa ser mutável pro Prisma aceitar, e o `as const` o tornava readonly. ⭐ Conferido que
   * **nenhum dos 5 chamadores** define `NOT` próprio — se um definir, o spread o apagaria em
   * silêncio, e aí a régua volta a ser duas.
   */
}

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
  /**
   * ⭐⭐⭐ 27/09 — **O DEGRAU DO VÍNCULO, e ele é o que faz o carimbo SOBREVIVER.**
   *
   * ⛔ Sem ele a escada devolvia `PENDING` pra toda linha sem categoria — inclusive a que o
   * gesto 🏦/💳/📈 acabou de resolver. Como esta função roda no fim de **todo** create/update
   * (é a defesa em profundidade de 29/06), **qualquer edição posterior** (mudar a descrição,
   * um lote de status) devolveria a linha pra "Pendente" e o defeito voltaria sozinho —
   * *silenciosamente*, que é o pior jeito.
   *
   * ⭐ `true` = há vínculo de gesto (parcela, fatura, aporte, liberação, transferência). Quem
   * responde isso é o `seloDoSistema`, nunca um `if` local: **uma régua, todos os andares.**
   */
  temVinculoDeGesto: boolean
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

  /**
   * ⭐⭐ (2) 27/09 — **VÍNCULO DE GESTO RESOLVE, e vem ANTES da categoria.**
   *
   * A pergunta do `status` é *"esta linha ainda espera alguém?"*, e com vínculo a resposta é
   * **não**: o dono já disse o que ela é pelo gesto próprio. ⚠️ E ele vem antes de propósito —
   * a categoria dessas linhas é `null` **por desenho** (ver `selo-do-sistema.ts`: gravar uma
   * viraria tag fantasma em relatório e envelheceria se o vínculo fosse desfeito), então
   * deixar a escada da categoria decidir é exatamente o defeito.
   */
  if (ctx.temVinculoDeGesto) return 'RECONCILED'

  // (3) Escada: categoria decide.
  return statusFromCategoryId(ctx.categoryId)
}
