// Sprint PF Fatia 4 — Criação atomic da ponte PJ→PF.
//
// 🔒 ISOLAMENTO TRIPLO:
// 1. RBAC empresa (transaction.create) — verificado no endpoint
// 2. checkProfileAccess(profileId, userId, 'OWNER') — aqui
// 3. tx PJ pertence à companyId — aqui

import { prisma } from '@/lib/db'
import { checkProfileAccess, ProfileAccessError } from '@/lib/personal-profile/queries'
import { BridgeError, type BridgeKind, type CreatedVia, BRIDGE_KINDS, CREATED_VIA } from './types'
import { getKindDefaults } from './kind-defaults'
import { resolvePjCategoryForKind } from './resolve-pj-category'
import { Prisma } from '@prisma/client'

export interface CreateBridgeInput {
  userId: string
  companyId: string
  pjTransactionId: string
  profileId: string
  pfBankAccountId: string
  pfCategoryId: string
  kind: BridgeKind
  createdVia?: CreatedVia
  socioPFId?: string | null
  notes?: string | null
}

export interface CreateBridgeResult {
  bridgeId: string
  pfTransactionId: string
}

/** Monta description da tx PF baseada no contexto. */
function buildPfDescription(
  kind: BridgeKind,
  companyName: string,
  date: Date,
  socioName?: string | null,
): string {
  const defaults = getKindDefaults(kind)
  const formatted = date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  const baseLabel = defaults.label
  const socioPart = socioName ? ` (${socioName})` : ''
  return `${baseLabel} ${companyName}${socioPart} · ${formatted}`
}

export async function createBridge(
  input: CreateBridgeInput,
): Promise<CreateBridgeResult> {
  // Validações de schema
  if (!BRIDGE_KINDS.includes(input.kind)) {
    throw new BridgeError(`Tipo de ponte inválido: ${input.kind}`, 'INVALID_KIND')
  }
  if (input.createdVia && !CREATED_VIA.includes(input.createdVia)) {
    throw new BridgeError(`createdVia inválido: ${input.createdVia}`, 'INVALID_KIND')
  }

  // 🔒 Camada 2: checkProfileAccess (OWNER)
  // Importante: chamamos ANTES do atomic pra que ProfileAccessError não
  // dispare retry desnecessário. Privacidade multi-sócio: sócio B com
  // profileId=A vai cair em NO_ACCESS aqui.
  try {
    await checkProfileAccess(input.userId, input.profileId, 'OWNER')
  } catch (err) {
    if (err instanceof ProfileAccessError) {
      // Traduz pra BridgeError código privacy-safe (404 não 403)
      throw new BridgeError(
        'Perfil PF não encontrado ou sem acesso',
        'PF_PROFILE_NOT_FOUND',
      )
    }
    throw err
  }

  // 🔒 Camada 3 + atomic
  try {
    // Resolve user metadata pra audit (1 query fora do atomic)
    const userMeta = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { name: true, email: true },
    })
    if (!userMeta) {
      throw new BridgeError('Usuário não encontrado', 'PF_PROFILE_NOT_FOUND')
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Buscar tx PJ + checar companyId + estado
      const pjTx = await tx.transaction.findUnique({
        where: { id: input.pjTransactionId },
        include: {
          bankAccount: { include: { company: true } },
          bridge: true,
        },
      })

      if (!pjTx) {
        throw new BridgeError('Transação PJ não encontrada', 'PJ_NOT_FOUND')
      }
      if (!pjTx.bankAccount) {
        throw new BridgeError(
          'Transação PJ sem conta bancária — não pode virar ponte',
          'PJ_NOT_FOUND',
        )
      }
      if (pjTx.bankAccount.companyId !== input.companyId) {
        throw new BridgeError(
          'Transação PJ não pertence à empresa informada',
          'COMPANY_MISMATCH',
        )
      }
      if (pjTx.type !== 'DEBIT') {
        throw new BridgeError(
          'Apenas saídas (DEBIT) podem virar ponte',
          'PJ_WRONG_TYPE',
        )
      }
      if (pjTx.lifecycle !== 'EFFECTED') {
        throw new BridgeError(
          'Apenas transações efetivadas (extrato real) podem virar ponte',
          'PJ_INVALID_LIFECYCLE',
        )
      }
      if (pjTx.isInternalTransfer) {
        throw new BridgeError(
          'Transferência interna entre empresas não pode virar ponte',
          'PJ_INTERNAL_TRANSFER',
        )
      }
      if (pjTx.transferGroupId) {
        throw new BridgeError(
          'Transferência entre contas da mesma empresa não pode virar ponte',
          'PJ_INTERNAL_TRANSFER',
        )
      }
      if (pjTx.bridge) {
        throw new BridgeError(
          'Esta transação PJ já tem ponte ativa',
          'PJ_ALREADY_BRIDGED',
        )
      }

      // 2. Conta PF + categoria PF do perfil correto
      const pfAccount = await tx.personalBankAccount.findUnique({
        where: { id: input.pfBankAccountId },
      })
      if (!pfAccount || pfAccount.profileId !== input.profileId) {
        throw new BridgeError(
          'Conta PF não encontrada no perfil',
          'PF_ACCOUNT_NOT_FOUND',
        )
      }
      const pfCategory = await tx.personalCategory.findUnique({
        where: { id: input.pfCategoryId },
      })
      if (
        !pfCategory ||
        (pfCategory.profileId && pfCategory.profileId !== input.profileId) ||
        pfCategory.type !== 'INCOME'
      ) {
        throw new BridgeError(
          'Categoria PF inválida (precisa ser do perfil + tipo INCOME)',
          'PF_CATEGORY_INVALID',
        )
      }

      // 3. SocioPF opcional — se passado, valida que pertence à mesma empresa
      if (input.socioPFId) {
        const socio = await tx.socioPF.findUnique({
          where: { id: input.socioPFId },
        })
        if (!socio || socio.companyId !== input.companyId) {
          throw new BridgeError(
            'SocioPF não pertence a esta empresa',
            'COMPANY_MISMATCH',
          )
        }
      }

      const companyName = pjTx.bankAccount.company.name
      let socioName: string | null = null
      if (input.socioPFId) {
        const s = await tx.socioPF.findUnique({
          where: { id: input.socioPFId },
        })
        socioName = s?.nome ?? null
      }

      // 4. Cria PersonalTransaction CREDIT
      const pfTx = await tx.personalTransaction.create({
        data: {
          profileId: input.profileId,
          bankAccountId: input.pfBankAccountId,
          categoryId: input.pfCategoryId,
          date: pjTx.date,
          description: buildPfDescription(
            input.kind,
            companyName,
            pjTx.date,
            socioName,
          ),
          amount: pjTx.amount,
          type: 'CREDIT',
          status: 'RECONCILED',
          origin: input.createdVia === 'CREATED_FROM_DETECTION' ? 'AI' : 'MANUAL',
          notes: input.notes ?? null,
        },
      })

      // Sprint Retirada-Despesa-PF/saldo-fix: incrementa balance da conta PF
      // (a entrada CREDIT precisa refletir no saldo cacheado, igual
      // createTransaction faz). Sem isso, Saldo Total do dashboard PF
      // ignora distribuições recebidas via ponte e fica negativo.
      await tx.personalBankAccount.update({
        where: { id: input.pfBankAccountId },
        data: { balance: { increment: pjTx.amount } },
      })

      // 5a. Sprint Retirada-Conciliação-Fix: seta categoryId na tx PJ pra que
      // o filtro Conciliação (categoryId IS NULL) deixe de retornar. Resolve
      // categoria certa por kind (DISTRIBUICAO → "Distribuição de Lucros",
      // PRO_LABORE → "Pró-labore", etc). Fail-open: se categoria não existir,
      // deixa NULL e a retirada continua salva (só fica visível na conciliação).
      const resolvedCategoryId = await resolvePjCategoryForKind(
        tx,
        input.companyId,
        input.kind,
      )
      if (resolvedCategoryId) {
        await tx.transaction.update({
          where: { id: pjTx.id },
          data: {
            categoryId: resolvedCategoryId,
            classificationSource: 'BRIDGE',
          },
        })
      }

      // 5. Cria Bridge
      const bridge = await tx.pJtoPFBridge.create({
        data: {
          pjTransactionId: pjTx.id,
          companyId: input.companyId,
          pfTransactionId: pfTx.id,
          profileId: input.profileId,
          kind: input.kind,
          amount: pjTx.amount,
          date: pjTx.date,
          socioPFId: input.socioPFId ?? null,
          createdById: input.userId,
          createdVia: input.createdVia ?? 'CREATED_MANUAL',
          notes: input.notes ?? null,
        },
      })

      // 6. Audit log scoped à empresa (1 entrada)
      await tx.auditLog.create({
        data: {
          companyId: input.companyId,
          userId: input.userId,
          userName: userMeta.name,
          userEmail: userMeta.email,
          action: 'BRIDGE_CREATED',
          entityType: 'PJtoPFBridge',
          entityId: bridge.id,
          metadata: JSON.stringify({
            pjTransactionId: pjTx.id,
            pfTransactionId: pfTx.id,
            kind: input.kind,
            amount: pjTx.amount,
            createdVia: input.createdVia ?? 'CREATED_MANUAL',
          }),
        },
      })

      return { bridgeId: bridge.id, pfTransactionId: pfTx.id }
    })
  } catch (err) {
    // P2002 (UNIQUE constraint violation) — race condition
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new BridgeError(
        'Esta transação PJ já tem ponte ativa (conflito de criação simultânea)',
        'PJ_ALREADY_BRIDGED',
      )
    }
    throw err
  }
}
