// Pareamento de 2 transações PENDING já importadas (mesma empresa, contas
// diferentes, sinais opostos, mesmo valor) → vira par TRANSFER atomic.
// Sprint 1.7.
//
// Caso típico: PIX entre contas próprias importado via OFX em ambas as
// contas. Sem essa feature, user precisaria categorizar manualmente
// (perdendo rastreio) ou criar transferência do zero (duplicando registro).
//
// Estratégia "dedupHash reservation" ESTENDIDA pra 2 lados — cada ponta
// TRANSFER herda o dedupHash da transação ORIGINAL DAQUELA conta. Re-import
// do OFX bate na constraint UNIQUE e skipa naturalmente. Zero duplicação.

import type { Prisma } from '@prisma/client'
import { TransferValidationError } from './validate'

export interface PendenteSnapshot {
  id: string
  bankAccountId: string
  bankAccountName: string
  bankAccountCompanyId: string
  type: string // 'CREDIT' | 'DEBIT' (string pra TS escape do Prisma)
  amount: number
  date: Date
  description: string
  // Pode ser null se a transação foi criada manualmente (sem OFX). Nesse caso
  // a ponta TRANSFER correspondente fica sem dedupHash — sem prejuízo, porque
  // não há OFX pra re-importar e duplicar.
  dedupHash: string | null
}

export interface BuildPairPendentesInput {
  txA: PendenteSnapshot
  txB: PendenteSnapshot
}

export interface PairPendentesAuditMetadata {
  source: 'pair-pendentes'
  deletedTransactionIds: string[]
  fromAccountId: string
  fromAccountName: string
  toAccountId: string
  toAccountName: string
  amount: number
  txAOriginalDedupHash: string | null
  txBOriginalDedupHash: string | null
}

export interface PairPendentesOperations {
  fromAccountId: string
  toAccountId: string
  fromAccountName: string
  toAccountName: string
  // Transações ORIGINAIS pareadas — pra apagar atomic
  deleteIdA: string
  deleteIdB: string
  // Par TRANSFER novo
  debitTx: Prisma.TransactionUncheckedCreateInput // saída no fromAccount
  creditTx: Prisma.TransactionUncheckedCreateInput // entrada no toAccount
  // Reverts de saldo dos deletes (aplica antes do create). Net final = 0.
  fromAccountRevertDelta: number // +amount (delete da DEBIT original reverte)
  toAccountRevertDelta: number // -amount (delete da CREDIT original reverte)
  // Apply dos creates (após revert)
  fromAccountApplyDelta: number // -amount (TRANSFER saída)
  toAccountApplyDelta: number // +amount (TRANSFER entrada)
  auditMetadata: PairPendentesAuditMetadata
}

const CENT = 0.01
const MS_PER_DAY = 24 * 60 * 60 * 1000
const MAX_DATE_DELTA_DAYS = 3

export function buildPairPendentes(
  input: BuildPairPendentesInput,
  groupId: string,
): PairPendentesOperations {
  const { txA, txB } = input

  // ============================================================
  // Validações — lança TransferValidationError → mapeada pra 400 na rota
  // ============================================================

  if (txA.id === txB.id) {
    throw new TransferValidationError('Não dá pra parear uma transação com ela mesma')
  }

  if (txA.bankAccountCompanyId !== txB.bankAccountCompanyId) {
    throw new TransferValidationError(
      'Pareamento só é permitido entre contas da mesma empresa',
    )
  }

  if (txA.bankAccountId === txB.bankAccountId) {
    throw new TransferValidationError(
      'As transações precisam estar em contas diferentes',
    )
  }

  // Tipos opostos: CREDIT ↔ DEBIT obrigatório
  const opposite =
    (txA.type === 'CREDIT' && txB.type === 'DEBIT') ||
    (txA.type === 'DEBIT' && txB.type === 'CREDIT')
  if (!opposite) {
    throw new TransferValidationError(
      `Tipos opostos requeridos: uma transação CREDIT e uma DEBIT. Recebido: ${txA.type} + ${txB.type}`,
    )
  }

  // Valores devem coincidir (tolerância 1 centavo)
  if (Math.abs(txA.amount - txB.amount) > CENT) {
    throw new TransferValidationError(
      `Valores divergem: ${txA.amount} vs ${txB.amount} (tolerância R$ 0,01)`,
    )
  }

  if (txA.amount <= 0) {
    throw new TransferValidationError('Valor deve ser positivo')
  }

  // Datas próximas (±3 dias). Defensivo — a rota /candidatas já filtra,
  // mas o caller poderia chamar com IDs arbitrários.
  const deltaDays = Math.abs(txA.date.getTime() - txB.date.getTime()) / MS_PER_DAY
  if (deltaDays > MAX_DATE_DELTA_DAYS) {
    throw new TransferValidationError(
      `Datas distantes: ${deltaDays.toFixed(1)} dias (máximo ${MAX_DATE_DELTA_DAYS})`,
    )
  }

  // ============================================================
  // Direção do par
  // ============================================================
  // fromAccount = conta da tx DEBIT (saída original)
  // toAccount   = conta da tx CREDIT (entrada original)

  const debitTxOriginal = txA.type === 'DEBIT' ? txA : txB
  const creditTxOriginal = txA.type === 'CREDIT' ? txA : txB

  const fromAccountId = debitTxOriginal.bankAccountId
  const toAccountId = creditTxOriginal.bankAccountId
  const fromAccountName = debitTxOriginal.bankAccountName
  const toAccountName = creditTxOriginal.bankAccountName

  // Usa o amount do par DEBIT como canonical (ambos batem ±1¢)
  const amount = round2(debitTxOriginal.amount)

  // Data da TRANSFER: a mais antiga das duas (data "real" do PIX/TED original)
  const transferDate =
    debitTxOriginal.date.getTime() <= creditTxOriginal.date.getTime()
      ? debitTxOriginal.date
      : creditTxOriginal.date

  // Description: preserva a mais informativa (sem perder rastro)
  const desc = debitTxOriginal.description || creditTxOriginal.description

  // ============================================================
  // Monta as transações TRANSFER
  // ============================================================
  // dedupHash preserved: cada ponta herda o hash da original DAQUELA conta.
  // Re-import OFX bate na unique [bankAccountId, dedupHash] e skipa.

  const debitTx: Prisma.TransactionUncheckedCreateInput = {
    bankAccountId: fromAccountId,
    categoryId: null,
    date: transferDate,
    description: desc || `Transferência para ${toAccountName}`,
    amount,
    type: 'TRANSFER',
    status: 'RECONCILED',
    origin: 'MANUAL',
    transferGroupId: groupId,
    dedupHash: debitTxOriginal.dedupHash,
    notes: null,
  }

  const creditTx: Prisma.TransactionUncheckedCreateInput = {
    bankAccountId: toAccountId,
    categoryId: null,
    date: transferDate,
    description: desc || `Transferência de ${fromAccountName}`,
    amount,
    type: 'TRANSFER',
    status: 'RECONCILED',
    origin: 'MANUAL',
    transferGroupId: groupId,
    dedupHash: creditTxOriginal.dedupHash,
    notes: null,
  }

  return {
    fromAccountId,
    toAccountId,
    fromAccountName,
    toAccountName,
    deleteIdA: txA.id,
    deleteIdB: txB.id,
    debitTx,
    creditTx,
    // Reverte impacto dos deletes:
    //   fromAccount (DEBIT original retirou amount) → revert += amount
    //   toAccount   (CREDIT original somou amount)  → revert -= amount
    fromAccountRevertDelta: amount,
    toAccountRevertDelta: -amount,
    // Aplica TRANSFER (igual ao Sprint 0.5 Dia 2):
    fromAccountApplyDelta: -amount,
    toAccountApplyDelta: amount,
    // Net final por conta: revert + apply = 0. Sem drift de saldo.
    auditMetadata: {
      source: 'pair-pendentes',
      deletedTransactionIds: [txA.id, txB.id],
      fromAccountId,
      fromAccountName,
      toAccountId,
      toAccountName,
      amount,
      txAOriginalDedupHash: txA.dedupHash,
      txBOriginalDedupHash: txB.dedupHash,
    },
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
