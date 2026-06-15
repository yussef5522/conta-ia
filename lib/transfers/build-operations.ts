// Função PURA que monta as 2 transações + deltas de saldo de uma transferência.
// Sem DB, sem prisma — fácil de testar.

import type { Prisma } from '@prisma/client'
import type { TransferInput } from './validate'

export interface TransferAccountSnapshot {
  id: string
  name: string
  companyId: string
}

export interface TransferOperations {
  // Saída na conta de origem (DEBIT)
  debitTx: Prisma.TransactionUncheckedCreateInput
  // Entrada na conta de destino (CREDIT)
  creditTx: Prisma.TransactionUncheckedCreateInput
  // Delta de saldo (a aplicar via balance: { increment })
  fromBalanceDelta: number // sempre negativo
  toBalanceDelta: number // sempre positivo
}

// Monta o par de transações. `groupId` é gerado externamente (rota chama crypto.randomUUID).
// As transações usam type='TRANSFER' (não CREDIT/DEBIT) pra DRE e Fluxo Consolidado
// filtrarem facilmente. `categoryId` é null porque transferência não tem categoria.
// Status 'RECONCILED' porque foi criada manualmente (não veio de import pendente).
export function buildTransferOperations(
  input: TransferInput,
  fromAccount: TransferAccountSnapshot,
  toAccount: TransferAccountSnapshot,
  groupId: string,
): TransferOperations {
  const baseDescription = input.description?.trim()

  const debitTx: Prisma.TransactionUncheckedCreateInput = {
    bankAccountId: fromAccount.id,
    categoryId: null,
    date: input.date,
    description: baseDescription || `Transferência para ${toAccount.name}`,
    amount: input.amount,
    type: 'TRANSFER',
    status: 'RECONCILED',
    origin: 'MANUAL',
    transferGroupId: groupId,
    // Fase 2: direção EXPLÍCITA (saída na conta de origem)
    transferDirection: 'OUT',
    notes: input.notes ?? null,
  }

  const creditTx: Prisma.TransactionUncheckedCreateInput = {
    bankAccountId: toAccount.id,
    categoryId: null,
    date: input.date,
    description: baseDescription || `Transferência de ${fromAccount.name}`,
    amount: input.amount,
    type: 'TRANSFER',
    status: 'RECONCILED',
    origin: 'MANUAL',
    transferGroupId: groupId,
    // Fase 2: direção EXPLÍCITA (entrada na conta de destino)
    transferDirection: 'IN',
    notes: input.notes ?? null,
  }

  return {
    debitTx,
    creditTx,
    fromBalanceDelta: -input.amount,
    toBalanceDelta: input.amount,
  }
}
