// Sprint PF Fatia 4 — Delete da ponte (2 modos A/B do plano §4.4).

import { prisma } from '@/lib/db'
import { BridgeError, type BridgeDeleteMode, BRIDGE_DELETE_MODES } from './types'
import { checkProfileAccess, ProfileAccessError } from '@/lib/personal-profile/queries'

export interface DeleteBridgeInput {
  userId: string
  bridgeId: string
  mode: BridgeDeleteMode
}

export interface DeleteBridgeResult {
  bridgeId: string
  pfTransactionDeleted: boolean
}

/**
 * Deleta a ponte.
 *  - LINK_ONLY: deleta só PJtoPFBridge, mantém as 2 tx.
 *  - WITH_PF_TX: deleta bridge + tx PF, mantém tx PJ.
 *
 * 🔒 Autorização: user precisa ser DONO do perfil PF da ponte OU o criador.
 * Se não for nenhum dos dois → BRIDGE_NOT_FOUND (não revela existência).
 */
export async function deleteBridge(
  input: DeleteBridgeInput,
): Promise<DeleteBridgeResult> {
  if (!BRIDGE_DELETE_MODES.includes(input.mode)) {
    throw new BridgeError('Modo de exclusão inválido', 'INVALID_MODE')
  }

  const bridge = await prisma.pJtoPFBridge.findUnique({
    where: { id: input.bridgeId },
  })
  if (!bridge) {
    throw new BridgeError('Ponte não encontrada', 'BRIDGE_NOT_FOUND')
  }

  // 🔒 Auth: dono do perfil OU criador
  const isCreator = bridge.createdById === input.userId
  let isOwner = false
  try {
    await checkProfileAccess(input.userId, bridge.profileId, 'OWNER')
    isOwner = true
  } catch (err) {
    if (!(err instanceof ProfileAccessError)) throw err
  }
  if (!isOwner && !isCreator) {
    throw new BridgeError('Ponte não encontrada', 'BRIDGE_NOT_FOUND')
  }

  const userMeta = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { name: true, email: true },
  })
  if (!userMeta) {
    throw new BridgeError('Usuário não encontrado', 'BRIDGE_NOT_FOUND')
  }

  return prisma.$transaction(async (tx) => {
    await tx.pJtoPFBridge.delete({ where: { id: input.bridgeId } })

    let pfDeleted = false
    if (input.mode === 'WITH_PF_TX') {
      // Sprint Retirada-Despesa-PF/saldo-fix: reverte saldo da conta PF
      // antes de deletar a tx (CREDIT vira decrement). Espelha o increment
      // feito no createBridge.
      const pfTx = await tx.personalTransaction.findUnique({
        where: { id: bridge.pfTransactionId },
        select: { bankAccountId: true, amount: true, type: true },
      })
      if (pfTx?.bankAccountId) {
        const delta = pfTx.type === 'CREDIT' ? -pfTx.amount : pfTx.amount
        await tx.personalBankAccount.update({
          where: { id: pfTx.bankAccountId },
          data: { balance: { increment: delta } },
        })
      }
      await tx.personalTransaction.delete({ where: { id: bridge.pfTransactionId } })
      pfDeleted = true
    }

    await tx.auditLog.create({
      data: {
        companyId: bridge.companyId,
        userId: input.userId,
        userName: userMeta.name,
        userEmail: userMeta.email,
        action:
          input.mode === 'WITH_PF_TX'
            ? 'BRIDGE_DELETED_WITH_PF_TX'
            : 'BRIDGE_DELETED_LINK_ONLY',
        entityType: 'PJtoPFBridge',
        entityId: bridge.id,
        metadata: JSON.stringify({
          pjTransactionId: bridge.pjTransactionId,
          pfTransactionId: bridge.pfTransactionId,
          kind: bridge.kind,
          amount: bridge.amount,
          mode: input.mode,
        }),
      },
    })

    return {
      bridgeId: bridge.id,
      pfTransactionDeleted: pfDeleted,
    }
  })
}
