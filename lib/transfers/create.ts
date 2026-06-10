// Cria transferência atomicamente: 2 transações + 2 updates de saldo + 1 audit log.
// Validações: mesma empresa + permission + saldo (vs creditLimit / allowNegativeBalance).

import { randomUUID } from 'crypto'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import type { AuthContext } from '@/lib/auth/rbac'
import { checkBalance, BalanceCheckError } from '@/lib/balance/check'
import {
  assertSameCompany,
  TransferValidationError,
  type TransferInput,
} from './validate'
import { buildTransferOperations } from './build-operations'
import { assertNoDuplicateTransferGroup } from './check-duplicate-group'

export interface CreatedTransfer {
  groupId: string
  fromAccount: { id: string; name: string; balance: number }
  toAccount: { id: string; name: string; balance: number }
  amount: number
  date: Date
}

export async function createTransfer(
  input: TransferInput,
  ctx: AuthContext,
  request?: NextRequest,
): Promise<CreatedTransfer> {
  // 1. Fetch das duas contas (precisamos do companyId + flags de saldo)
  const [fromAccount, toAccount] = await Promise.all([
    prisma.bankAccount.findUnique({
      where: { id: input.fromAccountId },
      select: {
        id: true,
        name: true,
        companyId: true,
        balance: true,
        allowNegativeBalance: true,
        creditLimit: true,
      },
    }),
    prisma.bankAccount.findUnique({
      where: { id: input.toAccountId },
      select: { id: true, name: true, companyId: true, balance: true },
    }),
  ])

  // 2. Validação de mesma empresa (lança TransferValidationError → 400)
  assertSameCompany(fromAccount, toAccount)

  // assertSameCompany já garantiu não-null; TS precisa do narrow
  if (!fromAccount || !toAccount) {
    throw new TransferValidationError('Contas inválidas')
  }

  // 3. Permission check — caller (rota) deve ter resolvido ctx contra companyId
  // das contas. Sanity check defensivo.
  if (ctx.company?.id !== fromAccount.companyId) {
    throw new TransferValidationError(
      'Contexto de autenticação não corresponde à empresa das contas',
    )
  }
  ctx.requirePermission('transaction.create')

  // 4. Sprint E1 (09/06/2026): bloqueia se já existe grupo com mesmas contas+
  // valor+data±1d. Caso real Cacula: usuário pareou R$ 34k banrisul→stone em
  // 08/jun (grupo 7de154c4); ao re-importar OFX no dia seguinte, criou outro
  // grupo (fb603cee) sem perceber → R$ 34k duplicado.
  await assertNoDuplicateTransferGroup({
    fromAccountId: fromAccount.id,
    toAccountId: toAccount.id,
    amount: input.amount,
    date: input.date,
  })

  // 5. Balance check: saída na conta de origem respeita creditLimit?
  const balanceCheck = checkBalance({
    currentBalance: fromAccount.balance,
    allowNegativeBalance: fromAccount.allowNegativeBalance,
    creditLimit: fromAccount.creditLimit,
    amountChange: -input.amount,
    accountName: fromAccount.name,
  })
  if (!balanceCheck.allowed) {
    throw new BalanceCheckError(balanceCheck)
  }

  // 5. Gera ID do grupo + monta operações (função pura)
  const groupId = randomUUID()
  const ops = buildTransferOperations(input, fromAccount, toAccount, groupId)

  // 6. Atomic: 2 creates + 2 balance updates
  const [debit, credit, fromUpdated, toUpdated] = await prisma.$transaction([
    prisma.transaction.create({ data: ops.debitTx }),
    prisma.transaction.create({ data: ops.creditTx }),
    prisma.bankAccount.update({
      where: { id: fromAccount.id },
      data: { balance: { increment: ops.fromBalanceDelta } },
      select: { id: true, name: true, balance: true },
    }),
    prisma.bankAccount.update({
      where: { id: toAccount.id },
      data: { balance: { increment: ops.toBalanceDelta } },
      select: { id: true, name: true, balance: true },
    }),
  ])

  // 7. Audit log fora do $transaction (não é crítico estar atomic com os creates)
  await logAudit(ctx, {
    action: 'CREATE',
    entityType: 'Transfer',
    entityId: groupId,
    metadata: {
      fromAccountId: fromAccount.id,
      fromAccountName: fromAccount.name,
      toAccountId: toAccount.id,
      toAccountName: toAccount.name,
      amount: input.amount,
      date: input.date.toISOString(),
      debitTxId: debit.id,
      creditTxId: credit.id,
    },
    request,
  })

  return {
    groupId,
    fromAccount: fromUpdated,
    toAccount: toUpdated,
    amount: input.amount,
    date: input.date,
  }
}
