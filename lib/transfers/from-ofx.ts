// Orquestrador "Replace OFX": deleta tx existente + cria par TRANSFER atomic.
// Sprint 0.5 Dia 4 (refinamento).
//
// Usa estratégia "dedupHash reservation": a transação TRANSFER criada na
// importingAccount recebe o dedupHash da OFX preview, ocupando o slot UNIQUE
// [bankAccountId, dedupHash] da tabela. Quando o import OFX rodar depois e
// tentar inserir essa transação, vai colidir e ser skipada como duplicada.

import { randomUUID } from 'crypto'
import { z } from 'zod'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { reAncorarContas } from '@/lib/balance/recalcular'
import { logAudit } from '@/lib/audit'
import type { AuthContext } from '@/lib/auth/rbac'
import { checkBalance, BalanceCheckError } from '@/lib/balance/check'
import { TransferValidationError } from './validate'
import { buildOfxReplaceOperations } from './build-ofx-replace'
import { assertNoDuplicateTransferGroup } from './check-duplicate-group'

export const fromOfxSchema = z.object({
  importingAccountId: z.string().cuid(),
  ofxTransaction: z.object({
    amount: z.coerce.number().positive('Valor deve ser positivo'),
    date: z.coerce.date(),
    description: z.string().max(255).optional(),
    type: z.enum(['CREDIT', 'DEBIT']),
    dedupHash: z.string().min(1, 'dedupHash obrigatório'),
    fitid: z.string().optional(),
  }),
  existingTransactionId: z.string().cuid(),
})

export type FromOfxInput = z.infer<typeof fromOfxSchema>

export interface CreatedFromOfxTransfer {
  groupId: string
  deletedTransactionId: string
  fromAccount: { id: string; name: string; balance: number }
  toAccount: { id: string; name: string; balance: number }
  amount: number
  date: Date
}

export async function createTransferFromOfx(
  input: FromOfxInput,
  ctx: AuthContext,
  request?: NextRequest,
): Promise<CreatedFromOfxTransfer> {
  // 1. Fetch em paralelo: conta importada + tx existente
  const [importingAccount, existingTx] = await Promise.all([
    prisma.bankAccount.findUnique({
      where: { id: input.importingAccountId },
      select: {
        id: true,
        name: true,
        companyId: true,
        balance: true,
        allowNegativeBalance: true,
        creditLimit: true,
      },
    }),
    prisma.transaction.findUnique({
      where: { id: input.existingTransactionId },
      include: {
        bankAccount: {
          select: {
            id: true,
            name: true,
            companyId: true,
            balance: true,
            allowNegativeBalance: true,
            creditLimit: true,
          },
        },
      },
    }),
  ])

  if (!importingAccount) {
    throw new TransferValidationError('Conta importada não encontrada')
  }
  if (!existingTx) {
    throw new TransferValidationError('Transação existente não encontrada')
  }

  // Sanity check ctx
  if (ctx.company?.id !== importingAccount.companyId) {
    throw new TransferValidationError(
      'Contexto de autenticação não corresponde à empresa da conta',
    )
  }

  // Operação envolve criar transações E deletar uma → exige as 2 permissions
  ctx.requirePermission('transaction.create')
  ctx.requirePermission('transaction.delete')

  // 2. Build operations (revalida todas as regras: same company, accounts differ,
  // tipos opostos, valores batendo). Lança TransferValidationError se quebrar.
  const groupId = randomUUID()
  const ops = buildOfxReplaceOperations(
    {
      importingAccount: {
        id: importingAccount.id,
        name: importingAccount.name,
        companyId: importingAccount.companyId,
      },
      existingTx: {
        id: existingTx.id,
        bankAccountId: existingTx.bankAccount!.id,
        bankAccountName: existingTx.bankAccount!.name,
        bankAccountCompanyId: existingTx.bankAccount!.companyId,
        type: existingTx.type,
        amount: existingTx.amount,
        categoryId: existingTx.categoryId,
        notes: existingTx.notes,
      },
      ofxTransaction: input.ofxTransaction,
    },
    groupId,
  )

  // Sprint E1 (09/06/2026): bloqueia se já existe grupo com mesmas contas+
  // valor+data±1d. Caso real Cacula: Replace OFX criou 2 grupos R$ 34k
  // banrisul↔stone em dias consecutivos (7de154c4 + fb603cee). Sem este
  // guard, Banrisul recicla FITID → re-import gera OFX nova órfã → user
  // pareia de novo → grupo paralelo.
  await assertNoDuplicateTransferGroup({
    fromAccountId: ops.fromAccountId,
    toAccountId: ops.toAccountId,
    amount: input.ofxTransaction.amount,
    date: input.ofxTransaction.date,
  })

  // 3. Balance check na fromAccount.
  // Se a fromAccount é a accountDoExisting, ela vai sofrer o revert ANTES da saída.
  // Calculamos o saldo "ajustado" pós-revert pra check ser realista.
  const fromIsImporting = ops.fromAccountId === importingAccount.id
  const fromAccountData = fromIsImporting ? importingAccount : existingTx.bankAccount
  const adjustedCurrentBalance = fromIsImporting
    ? fromAccountData!.balance
    : fromAccountData!.balance + ops.existingTxRevertDelta

  const balanceCheck = checkBalance({
    currentBalance: adjustedCurrentBalance,
    allowNegativeBalance: fromAccountData!.allowNegativeBalance,
    creditLimit: fromAccountData!.creditLimit,
    amountChange: -input.ofxTransaction.amount,
    accountName: fromAccountData!.name,
  })
  if (!balanceCheck.allowed) {
    throw new BalanceCheckError(balanceCheck)
  }

  // 4. Atomic $transaction:
  //    revert saldo da conta da existingTx → delete existingTx →
  //    create par TRANSFER → update saldos finais das 2 contas
  /**
   * ⭐ item 4 (30/09) — e aqui o delta era TRIPLO: revertia a conta da tx existente,
   * apagava, criava o par e somava nas duas pontas. **Três deltas encadeados sobre um
   * cache ancorado**: bastava um deles cair do lado errado da âncora pra ninguém mais
   * conseguir explicar o saldo. Agora são os fatos (delete + 2 creates) e UMA derivação
   * das três contas envolvidas, no fim.
   */
  const { debitCreated, creditCreated, fromUpdated, toUpdated } = await prisma.$transaction(
    async (tx) => {
      await tx.transaction.delete({ where: { id: existingTx.id } })
      const d = await tx.transaction.create({ data: ops.debitTx })
      const c = await tx.transaction.create({ data: ops.creditTx })
      const saldos = await reAncorarContas(tx, [
        existingTx.bankAccount!.id,
        ops.fromAccountId,
        ops.toAccountId,
      ])
      const porId = new Map(saldos.map((s) => [s.bankAccountId, s]))
      return {
        debitCreated: d,
        creditCreated: c,
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
    },
  )

  // 5. Audit log (fora do $transaction, consistente com createTransfer)
  await logAudit(ctx, {
    action: 'CREATE',
    entityType: 'Transfer',
    entityId: groupId,
    metadata: {
      ...ops.auditMetadata,
      debitTxId: debitCreated.id,
      creditTxId: creditCreated.id,
    },
    request,
  })

  return {
    groupId,
    deletedTransactionId: existingTx.id,
    fromAccount: fromUpdated,
    toAccount: toUpdated,
    amount: input.ofxTransaction.amount,
    date: input.ofxTransaction.date,
  }
}
