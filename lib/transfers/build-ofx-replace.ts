// Operações puras pra "Replace" de uma transação OFX por um par TRANSFER.
// Sprint 0.5 Dia 4 (refinamento).
//
// Cenário: o user está no preview OFX da Conta A. O sistema detectou que
// uma transação X do preview combina com uma transação Y JÁ EXISTENTE na
// Conta B (outra conta da MESMA empresa). Em vez de importar X normalmente
// (geraria duplicação com a transferência manual), fazemos:
//   1. DELETAR Y (reverte saldo da Conta B)
//   2. CRIAR par TRANSFER (saída + entrada com mesmo transferGroupId)
//   3. RESERVAR o slot UNIQUE [bankAccountId, dedupHash] na ponta TRANSFER
//      que fica em Conta A — com o dedupHash de X. Assim, quando o import
//      OFX rodar e tentar inserir X, vai colidir no UNIQUE e ser skipada
//      naturalmente. Zero mudança no endpoint de import.
//
// Esta função é PURA (sem DB). Validações + montagem do shape das operações
// pra o $transaction do orquestrador.

import type { Prisma } from '@prisma/client'
import { TransferValidationError } from './validate'

export interface OfxReplaceInput {
  importingAccount: {
    id: string
    name: string
    companyId: string
  }
  existingTx: {
    id: string
    bankAccountId: string
    bankAccountName: string
    bankAccountCompanyId: string
    type: string // 'CREDIT' | 'DEBIT' (string pra TS escape do Prisma)
    amount: number
    categoryId: string | null
    notes: string | null
  }
  ofxTransaction: {
    amount: number
    date: Date
    description?: string
    type: 'CREDIT' | 'DEBIT'
    dedupHash: string
    fitid?: string
  }
}

export interface OfxReplaceAuditMetadata {
  source: 'ofx-replace'
  deletedTransactionId: string
  deletedTxCategoryId: string | null
  deletedTxNotes: string | null
  fromAccountId: string
  fromAccountName: string
  toAccountId: string
  toAccountName: string
  amount: number
  importingAccountId: string
  ofxDedupHash: string
  ofxFitid?: string
}

export interface OfxReplaceOperations {
  fromAccountId: string
  toAccountId: string
  fromAccountName: string
  toAccountName: string
  // Delta pra reverter o impacto de saldo que a existingTx teve.
  // Se existing era CREDIT (somou amount), revert = -amount.
  // Se existing era DEBIT (subtraiu amount), revert = +amount.
  existingTxRevertDelta: number
  debitTx: Prisma.TransactionUncheckedCreateInput
  creditTx: Prisma.TransactionUncheckedCreateInput
  fromBalanceDelta: number // sempre -amount
  toBalanceDelta: number // sempre +amount
  auditMetadata: OfxReplaceAuditMetadata
}

export function buildOfxReplaceOperations(
  input: OfxReplaceInput,
  groupId: string,
): OfxReplaceOperations {
  // ============================================================
  // Validações (lançam TransferValidationError → mapeado pra 400)
  // ============================================================

  // Isolamento multi-tenant INVIOLÁVEL: mesma empresa
  if (input.importingAccount.companyId !== input.existingTx.bankAccountCompanyId) {
    throw new TransferValidationError(
      'Transferência só é permitida entre contas da mesma empresa',
    )
  }

  if (input.importingAccount.id === input.existingTx.bankAccountId) {
    throw new TransferValidationError(
      'Conta de origem e destino devem ser diferentes',
    )
  }

  // Tipos opostos (par válido de transferência)
  if (input.ofxTransaction.type === input.existingTx.type) {
    throw new TransferValidationError(
      `Tipos opostos requeridos: OFX é ${input.ofxTransaction.type} e existente também — não é um par válido de transferência`,
    )
  }

  // Valores devem coincidir (tolerância 1 centavo pra rounding)
  if (Math.abs(input.ofxTransaction.amount - input.existingTx.amount) > 0.01) {
    throw new TransferValidationError(
      `Valores divergem: OFX R$ ${input.ofxTransaction.amount} vs existente R$ ${input.existingTx.amount}`,
    )
  }

  if (input.ofxTransaction.amount <= 0) {
    throw new TransferValidationError('Valor deve ser positivo')
  }

  // ============================================================
  // Inferir direção do par TRANSFER
  // ============================================================
  //   - ofx.type=DEBIT → importingAccount é fromAccount (saída lá)
  //   - ofx.type=CREDIT → importingAccount é toAccount (entrada lá)

  const ofxIsDebit = input.ofxTransaction.type === 'DEBIT'

  const fromAccountId = ofxIsDebit
    ? input.importingAccount.id
    : input.existingTx.bankAccountId
  const toAccountId = ofxIsDebit
    ? input.existingTx.bankAccountId
    : input.importingAccount.id
  const fromAccountName = ofxIsDebit
    ? input.importingAccount.name
    : input.existingTx.bankAccountName
  const toAccountName = ofxIsDebit
    ? input.existingTx.bankAccountName
    : input.importingAccount.name

  const amount = input.ofxTransaction.amount

  // Revert do impacto da existingTx (que será deletada)
  const existingTxRevertDelta = input.existingTx.type === 'CREDIT' ? -amount : amount

  // dedupHash vai SÓ pra ponta da importingAccount (pra reservar o slot).
  // A outra ponta (conta do existingTx) NÃO precisa de dedupHash — não há
  // OFX vindo pra essa conta nesse fluxo.
  const importingIsFrom = ofxIsDebit

  const baseDescription = input.ofxTransaction.description?.trim()
  const defaultDebitDescription = `Transferência para ${toAccountName}`
  const defaultCreditDescription = `Transferência de ${fromAccountName}`

  const debitTx: Prisma.TransactionUncheckedCreateInput = {
    bankAccountId: fromAccountId,
    categoryId: null,
    date: input.ofxTransaction.date,
    description: baseDescription || defaultDebitDescription,
    amount,
    type: 'TRANSFER',
    status: 'RECONCILED',
    origin: 'MANUAL',
    transferGroupId: groupId,
    // Fase 2: ofxIsDebit ? importing=OUT : importing=IN (sempre saída no fromAccount)
    transferDirection: 'OUT',
    dedupHash: importingIsFrom ? input.ofxTransaction.dedupHash : null,
    notes: null,
  }

  const creditTx: Prisma.TransactionUncheckedCreateInput = {
    bankAccountId: toAccountId,
    categoryId: null,
    date: input.ofxTransaction.date,
    description: baseDescription || defaultCreditDescription,
    amount,
    type: 'TRANSFER',
    status: 'RECONCILED',
    origin: 'MANUAL',
    transferGroupId: groupId,
    // Fase 2: contraparte oposto (sempre entrada no toAccount)
    transferDirection: 'IN',
    dedupHash: importingIsFrom ? null : input.ofxTransaction.dedupHash,
    notes: null,
  }

  return {
    fromAccountId,
    toAccountId,
    fromAccountName,
    toAccountName,
    existingTxRevertDelta,
    debitTx,
    creditTx,
    fromBalanceDelta: -amount,
    toBalanceDelta: amount,
    auditMetadata: {
      source: 'ofx-replace',
      deletedTransactionId: input.existingTx.id,
      deletedTxCategoryId: input.existingTx.categoryId,
      deletedTxNotes: input.existingTx.notes,
      fromAccountId,
      fromAccountName,
      toAccountId,
      toAccountName,
      amount,
      importingAccountId: input.importingAccount.id,
      ofxDedupHash: input.ofxTransaction.dedupHash,
      ofxFitid: input.ofxTransaction.fitid,
    },
  }
}
