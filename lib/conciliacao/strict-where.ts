// Sprint Find-And-Match-Strict (30/06/2026) — FONTE DE VERDADE ÚNICA do
// filtro de "candidato válido de conciliação".
//
// Regra Yussef (= QuickBooks/Xero): SÓ Contas a Pagar/Receber em ABERTO
// na MESMA conta do extrato. Nunca EFFECTED já realizado, nunca de outra
// conta, nunca órfã Excel.
//
// Antes deste helper a regra estava duplicada em 2 lugares:
//   - lib/conciliacao/find-candidates.ts (corrigida na sprint Conciliacao-Strict)
//   - app/api/conciliacao/find-and-match/route.ts (ainda com RAMO 2 errado)
// Diagnóstico achou justamente esse drift. Centralizar elimina a classe
// inteira de "uma corrigida, outra não".
//
// NÃO afeta scan-retroativo (transferência entre bancos) nem auto-conciliacao
// (parcela de empréstimo) — eles têm queries próprias intocadas.

import type { Prisma } from '@prisma/client'

export interface StrictReconciliationOFX {
  type: 'CREDIT' | 'DEBIT'
  bankAccountId: string
}

export interface StrictDateWindow {
  /** Mínimo (inclusive) pra dueDate do candidato */
  gte: Date
  /** Máximo (inclusive) pra dueDate do candidato */
  lte: Date
}

/**
 * Constrói o `where` Prisma que define "candidato válido de conciliação".
 *
 * Regras combinadas via AND:
 *   1. lifecycle = PAYABLE (pra ofx.type DEBIT) ou RECEIVABLE (pra CREDIT)
 *   2. status = 'PENDING'
 *   3. type = ofx.type (direção bate)
 *   4. reconciledWithId IS NULL (nenhum link ainda)
 *   5. reconciledFrom NONE (ninguém aponta pra esta)
 *   6. paymentDate IS NULL (defesa em profundidade: em aberto = nunca paga)
 *   7. dueDate na janela (se fornecida)
 *   8. companyScope (multi-tenant — OR de 4 relações)
 *   9. sameAccountOrNull (bankAccountId null OU = ofx.bankAccountId)
 *
 * NÃO inclui `id: { not: ... }` nem busca textual nem exclusão de ids —
 * cada caller adiciona o que precisa POR CIMA via AND extra.
 *
 * @param ofx  Dados mínimos da tx OFX (type + bankAccountId)
 * @param companyId  Pra montar o companyScope multi-tenant
 * @param window  Janela de dueDate (opcional; sem janela = 'all')
 */
export function buildStrictReconciliationWhere(
  ofx: StrictReconciliationOFX,
  companyId: string,
  window?: StrictDateWindow,
): Prisma.TransactionWhereInput {
  const targetLifecycle = ofx.type === 'DEBIT' ? 'PAYABLE' : 'RECEIVABLE'

  // Multi-tenant via 4 relações (PAYABLE/RECEIVABLE muitas vezes criada sem
  // bankAccount — entra pelo supplier/customer/category).
  const companyScope: Prisma.TransactionWhereInput = {
    OR: [
      { bankAccount: { companyId } },
      { supplier: { companyId } },
      { customer: { companyId } },
      { category: { companyId } },
    ],
  }

  // Filtro CONTA:
  //   - PAYABLE sem banco (`bankAccountId: null`): pendência ainda não vinculada
  //     a conta — será setada ao conciliar.
  //   - PAYABLE da MESMA conta do extrato: legítimo casar.
  //   - PAYABLE de OUTRA conta: BLOQUEADO (nunca aparece).
  const sameAccountOrNull: Prisma.TransactionWhereInput = {
    OR: [
      { bankAccountId: null },
      { bankAccountId: ofx.bankAccountId },
    ],
  }

  return {
    lifecycle: targetLifecycle,
    status: 'PENDING',
    type: ofx.type,
    reconciledWithId: null,
    reconciledFrom: { none: {} },
    paymentDate: null,
    ...(window ? { dueDate: { gte: window.gte, lte: window.lte } } : {}),
    AND: [companyScope, sameAccountOrNull],
  }
}
