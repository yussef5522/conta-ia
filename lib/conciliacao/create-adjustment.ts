// Sprint A-effected Fase B.4.1 — Create adjustment transaction
//
// Cria uma tx de ajuste pareada com OFX dentro de um reconcile group.
// É uma tx EFFECTED com origin='ADJUSTMENT' que tem reconciledWithId
// apontando pra OFX e reconcileGroupId compartilhado com candidates do
// grupo.
//
// No DRE: tx ADJUSTMENT entra normalmente como qualquer EFFECTED com
// categoryId definido, mas filtrada pelo reconciledWithId IS NULL —
// NÃO, espera: a tx de ajuste TEM reconciledWithId NOT NULL.
//
// 🚨 Importante: pra ajuste APARECER no DRE, ele precisa NÃO ser filtrado
// pela cláusula `reconciledWithId IS NULL` da engine DRE realizada.
// Mas se removermos isso, voltamos à dupla contagem.
//
// Solução: ajuste TEM reconciledWithId apontando pra OFX (audit), mas o
// engine DRE precisa reconhecer `origin='ADJUSTMENT'` como uma EXCEÇÃO
// ao filtro — ajustes contam mesmo conciliados, pq não há "OFX original"
// representando o mesmo valor (a OFX representa só o total).
//
// Alternativa pragmática: deixar reconciledWithId=null no ajuste (mesmo
// ele estando no grupo). Identifica grupo via reconcileGroupId. DRE
// não filtra. Funciona naturalmente.
//
// DECISÃO: reconciledWithId=null no ajuste; reconcileGroupId aponta pro
// mesmo grupo do N:1. Undo agrupa via groupId. DRE conta como qualquer
// EFFECTED com categoryId.

import type { Prisma } from '@prisma/client'

export type AdjustmentSign = 'EXPENSE' | 'INCOME'

export interface CreateAdjustmentInput {
  ofxTransactionId: string
  bankAccountId: string
  companyId: string
  categoryId: string
  amount: number // SEMPRE positivo. sign determina type.
  sign: AdjustmentSign // EXPENSE = DEBIT, INCOME = CREDIT
  description: string
  reconcileGroupId: string
  date: Date // mesma da OFX
  userId: string
}

/**
 * Determina o `type` (DEBIT/CREDIT) baseado no sign do ajuste.
 *
 * - sign='EXPENSE' (Juros/Tarifas/Arredondamento) → DEBIT
 * - sign='INCOME' (Desconto Obtido) → CREDIT
 */
export function adjustmentTypeFromSign(sign: AdjustmentSign): 'DEBIT' | 'CREDIT' {
  return sign === 'EXPENSE' ? 'DEBIT' : 'CREDIT'
}

/**
 * Computes signed amount pra cálculo de diff.
 *
 * - EXPENSE (sign=DEBIT): amount positivo (banco pagou mais → soma)
 * - INCOME (sign=CREDIT): amount negativo (banco pagou menos → subtrai)
 *
 * Usado em validação: SUM(candidates) + SUM(signed adjustments) == OFX.amount
 */
export function adjustmentSignedAmount(
  amount: number,
  sign: AdjustmentSign,
): number {
  if (amount < 0) throw new Error('amount precisa ser positivo')
  return sign === 'EXPENSE' ? amount : -amount
}

/**
 * Builder do data Prisma pra criar a tx de ajuste.
 * Função pura testável — não toca Prisma diretamente.
 */
export function buildAdjustmentTxData(
  input: CreateAdjustmentInput,
): Prisma.TransactionUncheckedCreateInput {
  if (input.amount <= 0) {
    throw new Error('Adjustment amount precisa ser positivo')
  }
  if (!input.categoryId) {
    throw new Error('categoryId obrigatório no ajuste')
  }
  if (!input.description || input.description.trim().length === 0) {
    throw new Error('description obrigatória no ajuste')
  }

  const type = adjustmentTypeFromSign(input.sign)

  return {
    bankAccountId: input.bankAccountId,
    date: input.date,
    description: input.description,
    amount: input.amount,
    type,
    status: 'RECONCILED', // já sai conciliada (parte de um grupo)
    origin: 'ADJUSTMENT',
    lifecycle: 'EFFECTED',
    paymentDate: input.date,
    categoryId: input.categoryId,
    // CRÍTICO: reconciledWithId fica NULL (ajuste é EFFECTED próprio,
    // entra no DRE como qualquer outra tx categorizada).
    // reconcileGroupId aponta pro grupo (pra undo agrupado).
    reconciledWithId: null,
    reconcileGroupId: input.reconcileGroupId,
    isInternalTransfer: false,
    cashCoded: false,
  }
}
