// Exclui transferência: SEMPRE remove o par completo + reverte os 2 saldos.
// Nunca exclui só uma ponta (DRE/Fluxo dependem da integridade do par).

import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { reAncorarContas } from '@/lib/balance/recalcular'
import { logAudit } from '@/lib/audit'
import type { AuthContext } from '@/lib/auth/rbac'
import { TransferValidationError } from './validate'

export interface DeletedTransfer {
  groupId: string
  deletedTransactionIds: string[]
}

export async function deleteTransferGroup(
  groupId: string,
  ctx: AuthContext,
  request?: NextRequest,
): Promise<DeletedTransfer> {
  // Fetch as 2 pontas ordenadas por createdAt: a saída (from) é criada primeiro
  // pelo $transaction([create debit, create credit, ...]) em create.ts.
  // Em caso de empate (raríssimo, mesma ms), desempate por id.
  const pair = await prisma.transaction.findMany({
    where: { transferGroupId: groupId },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    include: {
      bankAccount: { select: { id: true, companyId: true, name: true } },
    },
  })

  if (pair.length === 0) {
    throw new TransferValidationError('Transferência não encontrada')
  }
  if (pair.length !== 2) {
    throw new TransferValidationError(
      `Par de transferência corrompido: encontradas ${pair.length} pontas em vez de 2`,
    )
  }

  const [fromSide, toSide] = pair
  // Sprint 4.0.1.a — TRANSFER por construção SEMPRE tem ambos bankAccountId e bankAccount.
  if (!fromSide.bankAccountId || !toSide.bankAccountId || !fromSide.bankAccount || !toSide.bankAccount) {
    throw new TransferValidationError(
      'Par de transferência corrompido: bankAccount ausente em pelo menos uma ponta',
    )
  }
  if (fromSide.bankAccount.companyId !== toSide.bankAccount.companyId) {
    throw new TransferValidationError(
      'Par de transferência tem contas de empresas diferentes (estado inválido)',
    )
  }

  // Sanity check: ctx deve estar resolvido pra empresa das contas
  if (ctx.company?.id !== fromSide.bankAccount.companyId) {
    throw new TransferValidationError(
      'Contexto de autenticação não corresponde à empresa das contas',
    )
  }
  ctx.requirePermission('transaction.delete')

  /**
   * ⭐ item 4 (30/09): apaga as duas pontas e RE-ANCORA as duas contas.
   *
   * ⚠️ A ORDEM inverteu: antes o saldo era revertido ANTES dos deletes; derivação precisa
   * do ledger no estado FINAL (as pontas já fora), senão ela recontaria o que está sendo
   * apagado. Com delta a ordem não importava; com derivação, importa.
   */
  await prisma.$transaction(async (tx) => {
    await tx.transaction.delete({ where: { id: fromSide.id } })
    await tx.transaction.delete({ where: { id: toSide.id } })
    await reAncorarContas(tx, [fromSide.bankAccountId, toSide.bankAccountId])
  })

  await logAudit(ctx, {
    action: 'DELETE',
    entityType: 'Transfer',
    entityId: groupId,
    metadata: {
      deletedTransactionIds: [fromSide.id, toSide.id],
      fromAccount: { id: fromSide.bankAccountId, name: fromSide.bankAccount.name },
      toAccount: { id: toSide.bankAccountId, name: toSide.bankAccount.name },
      amount: fromSide.amount,
    },
    request,
  })

  return {
    groupId,
    deletedTransactionIds: [fromSide.id, toSide.id],
  }
}
