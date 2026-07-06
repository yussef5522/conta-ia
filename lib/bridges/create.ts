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
  /**
   * Sprint Fluxo-A/B-Ponte (05/07/2026): fluxo B ("já gastei esse dinheiro").
   * Quando presente, dentro do MESMO $transaction cria também a PF DEBIT
   * (despesa) e vincula via bridge.spendTransactionId. Saldo PF net zero
   * (entra + sai = zero). Reusa a mesma conta PF da entrada.
   *
   * Fluxo A = spend ausente/undefined (comportamento original inalterado).
   */
  spend?: {
    /** Categoria PF EXPENSE do mesmo perfil. */
    categoryId: string
    /** Default = amount da retirada PJ. */
    amount?: number
    /** Default = "<categoria> — <descrição PJ>". */
    description?: string
    /** Default = date da retirada PJ. */
    date?: Date
    /** Conta PF do lançamento da despesa. Default = pfBankAccountId da entrada. */
    bankAccountId?: string
    notes?: string | null
  }
}

export interface CreateBridgeResult {
  bridgeId: string
  pfTransactionId: string
  /** Sprint Fluxo-A/B-Ponte: presente quando fluxo B (input.spend passado). */
  spendTransactionId?: string
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
            // Sprint Escada-Status (28/06/2026): tx PJ ganhou categoria via
            // bridge → escada sobe pra RECONCILED. Sem isso, ficava em
            // estado invertido (badge "Pendente" enganador em /movimentacoes
            // mesmo tendo Distribuição de Lucros/Pró-labore atribuído).
            status: 'RECONCILED',
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

      // 5b. Sprint Fluxo-A/B-Ponte (05/07/2026): fluxo B one-shot atomic.
      //
      // Se o caller passou `input.spend`, cria também a PersonalTransaction
      // DEBIT (despesa) DENTRO deste $transaction e liga via
      // bridge.spendTransactionId. Regras:
      //   - Categoria precisa ser EXPENSE do mesmo perfil (ou global);
      //   - Conta PF default = mesma da entrada (pfBankAccountId);
      //   - Amount default = amount da retirada (net zero);
      //   - Description default = "<categoria> — <descrição PJ>";
      //   - Date default = date da retirada PJ.
      //
      // Se qualquer validação falha, ROLLBACK total (entrada + bridge tampouco
      // são persistidas). É o que garante o one-shot atomic: sem meio-estado.
      let spendTxId: string | undefined
      if (input.spend) {
        const spendCategoryId = input.spend.categoryId
        const spendCategory = await tx.personalCategory.findUnique({
          where: { id: spendCategoryId },
        })
        if (
          !spendCategory ||
          (spendCategory.profileId !== null &&
            spendCategory.profileId !== input.profileId) ||
          spendCategory.type !== 'EXPENSE'
        ) {
          throw new BridgeError(
            'Categoria da despesa PF inválida (precisa ser EXPENSE do perfil)',
            'PF_CATEGORY_INVALID',
          )
        }

        // Conta PF do gasto: default = mesma da entrada. Se caller sobrescreve,
        // valida pertencer ao perfil.
        const spendAccountId = input.spend.bankAccountId ?? input.pfBankAccountId
        if (spendAccountId !== input.pfBankAccountId) {
          const acc = await tx.personalBankAccount.findUnique({
            where: { id: spendAccountId },
          })
          if (!acc || acc.profileId !== input.profileId) {
            throw new BridgeError(
              'Conta PF da despesa inválida',
              'PF_ACCOUNT_NOT_FOUND',
            )
          }
        }

        const spendAmount = input.spend.amount ?? pjTx.amount
        if (spendAmount <= 0) {
          throw new BridgeError(
            'Valor da despesa deve ser positivo',
            'PF_CATEGORY_INVALID',
          )
        }

        const spendDescription =
          input.spend.description?.trim() ||
          `${spendCategory.name} — ${pjTx.description}`
        const spendDate = input.spend.date ?? pjTx.date

        const spendTx = await tx.personalTransaction.create({
          data: {
            profileId: input.profileId,
            bankAccountId: spendAccountId,
            categoryId: spendCategoryId,
            date: spendDate,
            description: spendDescription,
            amount: Math.abs(spendAmount),
            type: 'DEBIT',
            status: 'RECONCILED',
            origin: input.createdVia === 'CREATED_FROM_DETECTION' ? 'AI' : 'MANUAL',
            notes: input.spend.notes ?? null,
          },
        })

        // Ajusta saldo da conta PF (débito): decrementa. Como o mesmo balance
        // já foi incrementado no passo 4 (entrada), o net final é zero quando
        // spendAmount == pjTx.amount (caso típico "atravessou o PF").
        await tx.personalBankAccount.update({
          where: { id: spendAccountId },
          data: { balance: { decrement: Math.abs(spendAmount) } },
        })

        // Liga bridge ↔ despesa. UNIQUE em spendTransactionId protege contra
        // race duplicada (P2002 abaixo).
        await tx.pJtoPFBridge.update({
          where: { id: bridge.id },
          data: { spendTransactionId: spendTx.id },
        })

        spendTxId = spendTx.id
      }

      // 6. Audit log scoped à empresa (1 entrada — cobre A e B)
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
            // Sprint Fluxo-A/B-Ponte: rastreia fluxo B pro audit.
            spendTransactionId: spendTxId ?? null,
            spendCategoryId: input.spend?.categoryId ?? null,
          }),
        },
      })

      return { bridgeId: bridge.id, pfTransactionId: pfTx.id, spendTransactionId: spendTxId }
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
