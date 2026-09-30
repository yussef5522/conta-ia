// Orchestrator: vincula 2 transações PENDING já importadas como par TRANSFER.
// Sprint 1.7.
//
// Atomic: revert saldos dos deletes + delete ambas + create par TRANSFER +
// apply saldos. Net final por conta = 0 (delete reverte + create aplica).

import { randomUUID } from 'crypto'
import { z } from 'zod'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { reAncorarContas } from '@/lib/balance/recalcular'
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

  /**
   * 3. Atomic: delete as duas originais + create o par + RE-ANCORA as 2 contas.
   *
   * ⭐⭐ item 4 (30/09) — e este caso é o mais instrutivo da leva. O comentário antigo dizia
   * que separar *revert* e *apply* **"protege contra qualquer drift se Prisma tiver bug de
   * ordering"**: quatro deltas encadeados pra tentar garantir uma soma. A derivação é
   * estritamente mais forte — ela **não depende de ordem nenhuma**, porque não soma nada:
   * lê o ledger final e diz qual é o saldo. O que os 4 deltas tentavam proteger deixou de
   * poder acontecer.
   *
   * ⚠️ E o audit-trail que eles davam não se perde: ele vive no `logAudit` abaixo, com os
   * ids das linhas e as contas — que é onde alguém vai procurar em três meses, não no
   * encadeamento de increments.
   */
  const { debit, credit, fromUpdated, toUpdated } = await prisma.$transaction(async (tx) => {
    await tx.transaction.delete({ where: { id: ops.deleteIdA } })
    await tx.transaction.delete({ where: { id: ops.deleteIdB } })
    // debit antes do credit — convenção do deleteTransferGroup (createdAt ASC = saída 1º)
    const d = await tx.transaction.create({ data: ops.debitTx })
    const c = await tx.transaction.create({ data: ops.creditTx })
    const saldos = await reAncorarContas(tx, [ops.fromAccountId, ops.toAccountId])
    const porId = new Map(saldos.map((s) => [s.bankAccountId, s]))
    return {
      debit: d,
      credit: c,
      fromUpdated: {
        id: ops.fromAccountId,
        name: porId.get(ops.fromAccountId)!.bankAccountName,
        balance: porId.get(ops.fromAccountId)!.saldoDepois,
      },
      toUpdated: {
        id: ops.toAccountId,
        name: porId.get(ops.toAccountId)!.bankAccountName,
        balance: porId.get(ops.toAccountId)!.saldoDepois,
      },
    }
  })

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
