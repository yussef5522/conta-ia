// Orchestrator: vincula 2 transações PENDING já importadas como par TRANSFER.
// Sprint 1.7.
//
// Atomic: revert saldos dos deletes + delete ambas + create par TRANSFER +
// apply saldos. Net final por conta = 0 (delete reverte + create aplica).

import { randomUUID } from 'crypto'
import { z } from 'zod'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import type { AuthContext } from '@/lib/auth/rbac'
import { TransferValidationError } from './validate'
import { buildPairPendentes } from './build-pair-pendentes'

export const pairPendentesSchema = z.object({
  transacaoIdA: z.string().cuid(),
  transacaoIdB: z.string().cuid(),
})

export type PairPendentesInput = z.infer<typeof pairPendentesSchema>

export interface CreatedPairPendentes {
  groupId: string
  deletedTransactionIds: [string, string]
  fromAccount: { id: string; name: string; balance: number }
  toAccount: { id: string; name: string; balance: number }
  amount: number
}

export async function pairPendentes(
  input: PairPendentesInput,
  ctx: AuthContext,
  request?: NextRequest,
): Promise<CreatedPairPendentes> {
  // 1. Fetch as duas transações em paralelo (com bankAccount.companyId)
  const [txA, txB] = await Promise.all([
    prisma.transaction.findUnique({
      where: { id: input.transacaoIdA },
      include: {
        bankAccount: { select: { id: true, name: true, companyId: true } },
      },
    }),
    prisma.transaction.findUnique({
      where: { id: input.transacaoIdB },
      include: {
        bankAccount: { select: { id: true, name: true, companyId: true } },
      },
    }),
  ])

  if (!txA) throw new TransferValidationError('Transação A não encontrada')
  if (!txB) throw new TransferValidationError('Transação B não encontrada')

  // Defensivo: só pareia PENDING (transações conciliadas com categoria não devem
  // ser apagadas sem que o user saiba o que vai perder)
  if (txA.status !== 'PENDING' || txB.status !== 'PENDING') {
    throw new TransferValidationError(
      'Pareamento só permitido entre transações com status PENDING',
    )
  }

  // Sanity check ctx — caller (rota) deve ter resolvido ctx pra companyId correto
  if (ctx.company?.id !== txA.bankAccount!.companyId) {
    throw new TransferValidationError(
      'Contexto de autenticação não corresponde à empresa da transação',
    )
  }

  // Permissões: cria TRANSFER novo + deleta as 2 originais
  ctx.requirePermission('transaction.create')
  ctx.requirePermission('transaction.delete')

  // 2. Build operations (revalida tudo: mesma empresa, contas diferentes,
  // tipos opostos, valores ±1¢, datas ±3d, etc)
  const groupId = randomUUID()
  const ops = buildPairPendentes(
    {
      txA: {
        id: txA.id,
        bankAccountId: txA.bankAccount!.id,
        bankAccountName: txA.bankAccount!.name,
        bankAccountCompanyId: txA.bankAccount!.companyId,
        type: txA.type,
        amount: txA.amount,
        date: txA.date,
        description: txA.description,
        dedupHash: txA.dedupHash,
      },
      txB: {
        id: txB.id,
        bankAccountId: txB.bankAccount!.id,
        bankAccountName: txB.bankAccount!.name,
        bankAccountCompanyId: txB.bankAccount!.companyId,
        type: txB.type,
        amount: txB.amount,
        date: txB.date,
        description: txB.description,
        dedupHash: txB.dedupHash,
      },
    },
    groupId,
  )

  // 3. Atomic: revert deletes + delete ambas + create par + apply
  //
  // Por que separar revert + apply em vez de net direto: garante audit-trail
  // explícito do que aconteceu com cada saldo, mesmo que matematicamente seja 0.
  // E protege contra qualquer drift se Prisma tiver bug de ordering.
  const [, , , , debit, credit, fromUpdated, toUpdated] =
    await prisma.$transaction([
      // Revert saldos
      prisma.bankAccount.update({
        where: { id: ops.fromAccountId },
        data: { balance: { increment: ops.fromAccountRevertDelta } },
      }),
      prisma.bankAccount.update({
        where: { id: ops.toAccountId },
        data: { balance: { increment: ops.toAccountRevertDelta } },
      }),
      // Delete originais
      prisma.transaction.delete({ where: { id: ops.deleteIdA } }),
      prisma.transaction.delete({ where: { id: ops.deleteIdB } }),
      // Create TRANSFER (debit na ordem antes do credit — convenção do
      // deleteTransferGroup: createdAt ASC = saída primeiro)
      prisma.transaction.create({ data: ops.debitTx }),
      prisma.transaction.create({ data: ops.creditTx }),
      // Apply TRANSFER nos saldos
      prisma.bankAccount.update({
        where: { id: ops.fromAccountId },
        data: { balance: { increment: ops.fromAccountApplyDelta } },
        select: { id: true, name: true, balance: true },
      }),
      prisma.bankAccount.update({
        where: { id: ops.toAccountId },
        data: { balance: { increment: ops.toAccountApplyDelta } },
        select: { id: true, name: true, balance: true },
      }),
    ])

  // 4. Audit log
  await logAudit(ctx, {
    action: 'CREATE',
    entityType: 'Transfer',
    entityId: groupId,
    metadata: {
      ...ops.auditMetadata,
      debitTxId: debit.id,
      creditTxId: credit.id,
    },
    request,
  })

  return {
    groupId,
    deletedTransactionIds: [ops.deleteIdA, ops.deleteIdB],
    fromAccount: fromUpdated,
    toAccount: toUpdated,
    amount: ops.auditMetadata.amount,
  }
}
