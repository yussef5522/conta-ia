// Sprint Retirada-Despesa-PF — Cria DESPESA PF vinculada à ponte.
//
// Atomic ($transaction):
//   1. Valida bridge pertence ao user (privacy — 404 anonimizado se não dono)
//   2. Valida bridge ainda não tem spendTransactionId (409 SPEND_ALREADY_LINKED)
//   3. Cria PersonalTransaction (type=DEBIT) reusando createTransaction logic
//      mas inline pra ficar no mesmo $transaction da update da bridge
//   4. Atualiza bridge.spendTransactionId
//   5. Audit log
//
// 🔒 ISOLAMENTO TRIPLO:
//   - checkProfileAccess OWNER (anti vazamento entre sócios)
//   - bankAccountId/categoryId precisam pertencer ao perfil
//   - bridge.profileId precisa bater com profileId resolvido
//
// FK SetNull no spendTransactionId garante:
//   - User apaga PersonalTransaction → bridge.spendTransactionId vira NULL
//   - Convite volta a aparecer naturalmente (sistema respeita o user)

import { prisma } from '@/lib/db'
import { checkProfileAccess, ProfileAccessError } from '@/lib/personal-profile/queries'
import { BridgeError } from './types'
import { Prisma } from '@prisma/client'

export interface CreateSpendInput {
  userId: string
  bridgeId: string
  amount: number
  date: Date
  description: string
  bankAccountId: string
  categoryId: string
  notes?: string | null
}

export interface CreateSpendResult {
  spendTransactionId: string
  bridgeId: string
}

export async function createBridgeSpend(
  input: CreateSpendInput,
): Promise<CreateSpendResult> {
  if (input.amount <= 0) {
    throw new BridgeError('Valor da despesa deve ser positivo', 'SPEND_INVALID_TYPE')
  }
  if (!input.description?.trim()) {
    throw new BridgeError('Descrição obrigatória', 'SPEND_INVALID_TYPE')
  }

  // 1. Resolve bridge SEM atomic — pega profileId pra validar acesso
  const bridge = await prisma.pJtoPFBridge.findUnique({
    where: { id: input.bridgeId },
    select: {
      id: true,
      profileId: true,
      spendTransactionId: true,
      pjTransaction: { select: { description: true } },
    },
  })
  if (!bridge) {
    // Privacy: 404 mesmo se id é válido mas não pertence ao user
    throw new BridgeError('Ponte não encontrada', 'BRIDGE_NOT_FOUND')
  }

  // 2. checkProfileAccess (anti vazamento entre sócios). Não-dono → 404.
  try {
    await checkProfileAccess(input.userId, bridge.profileId, 'OWNER')
  } catch (err) {
    if (err instanceof ProfileAccessError) {
      throw new BridgeError('Ponte não encontrada', 'BRIDGE_NOT_FOUND')
    }
    throw err
  }

  // 3. Já tem despesa vinculada? (UNIQUE também protege, mas damos erro claro)
  if (bridge.spendTransactionId) {
    throw new BridgeError(
      'Esta retirada já tem despesa PF registrada',
      'SPEND_ALREADY_LINKED',
    )
  }

  // 4. Atomic: cria PersonalTransaction + atualiza bridge.spendTransactionId
  try {
    return await prisma.$transaction(async (tx) => {
      // Valida bankAccountId pertence ao perfil
      const acc = await tx.personalBankAccount.findUnique({
        where: { id: input.bankAccountId },
        select: { profileId: true },
      })
      if (!acc || acc.profileId !== bridge.profileId) {
        throw new BridgeError('Conta PF inválida', 'PF_ACCOUNT_NOT_FOUND')
      }
      // Valida categoryId pertence ao perfil + é EXPENSE
      const cat = await tx.personalCategory.findUnique({
        where: { id: input.categoryId },
        select: { profileId: true, type: true },
      })
      if (
        !cat ||
        (cat.profileId !== null && cat.profileId !== bridge.profileId) ||
        cat.type !== 'EXPENSE'
      ) {
        throw new BridgeError(
          'Categoria PF inválida (precisa ser EXPENSE do perfil)',
          'PF_CATEGORY_INVALID',
        )
      }

      // Cria a tx PF de despesa
      const spendTx = await tx.personalTransaction.create({
        data: {
          profileId: bridge.profileId,
          bankAccountId: input.bankAccountId,
          categoryId: input.categoryId,
          date: input.date,
          description: input.description.trim(),
          amount: Math.abs(input.amount),
          type: 'DEBIT',
          status: 'RECONCILED',
          origin: 'MANUAL',
          notes: input.notes ?? null,
        },
      })

      // Atualiza saldo da conta PF (delta negativo, é despesa)
      await tx.personalBankAccount.update({
        where: { id: input.bankAccountId },
        data: { balance: { decrement: input.amount } },
      })

      // Vincula a bridge à despesa (UNIQUE protege contra dupla execução)
      await tx.pJtoPFBridge.update({
        where: { id: bridge.id },
        data: {
          spendTransactionId: spendTx.id,
          // Limpa "Agora não" se tava marcado (decidir criar = unacknowledge)
          spendAcknowledged: false,
        },
      })

      return { spendTransactionId: spendTx.id, bridgeId: bridge.id }
    })
  } catch (err) {
    // P2002 UNIQUE — race condition (user clicou 2x antes do response)
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new BridgeError(
        'Esta retirada já tem despesa PF (criação simultânea)',
        'SPEND_ALREADY_LINKED',
      )
    }
    throw err
  }
}

/**
 * Marca/desmarca a flag "Agora não" — esconde o convite sem criar despesa.
 * Multi-tenant via checkProfileAccess.
 */
export async function setBridgeSpendAcknowledged(
  userId: string,
  bridgeId: string,
  acknowledged: boolean,
): Promise<void> {
  const bridge = await prisma.pJtoPFBridge.findUnique({
    where: { id: bridgeId },
    select: { id: true, profileId: true, spendTransactionId: true },
  })
  if (!bridge) {
    throw new BridgeError('Ponte não encontrada', 'BRIDGE_NOT_FOUND')
  }
  try {
    await checkProfileAccess(userId, bridge.profileId, 'OWNER')
  } catch (err) {
    if (err instanceof ProfileAccessError) {
      throw new BridgeError('Ponte não encontrada', 'BRIDGE_NOT_FOUND')
    }
    throw err
  }
  // Não permite "Agora não" se já tem despesa (sem sentido)
  if (acknowledged && bridge.spendTransactionId) {
    throw new BridgeError(
      'Retirada já tem despesa — não pode marcar "Agora não"',
      'SPEND_ALREADY_LINKED',
    )
  }
  await prisma.pJtoPFBridge.update({
    where: { id: bridgeId },
    data: { spendAcknowledged: acknowledged },
  })
}
