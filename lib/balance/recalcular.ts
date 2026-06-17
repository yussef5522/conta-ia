// Sprint Saldo-Ancorado-LEDGERBAL (17/06/2026).
//
// "O banco é a lei": balance ancorado no LEDGERBAL do extrato OFX, não em
// increment cumulativo (que driftou na Cacula: sistema +R$ 92k vs real
// -R$ 37,5k).
//
// REGRA:
//   COM extrato (ledgerBalDate IS NOT NULL):
//     balance = ledgerBal + SUM(signed amount WHERE date > ledgerBalDate)
//     Tx até ledgerBalDate JÁ estão no LEDGERBAL — não somam de novo.
//
//   SEM extrato (caixa físico, manual):
//     balance = SUM(signed amount de todas as tx da conta)
//
// Reusa lib/balance/prepare.ts (prepareBalanceTransactions) pra resolver
// sinal de CREDIT/DEBIT/TRANSFER (incluindo TRANSFER com transferDirection
// OUT/IN e fallback createdAt-ASC).

import type { PrismaClient } from '@prisma/client'
import { prepareBalanceTransactions, type RawBalanceTransaction } from './prepare'

export interface RecalcResult {
  bankAccountId: string
  bankAccountName: string
  modo: 'LEDGERBAL_ANCHOR' | 'SUM_TODAS'
  ledgerBal: number | null
  ledgerBalDate: Date | null
  /** Soma dos signed amounts considerados (pós-ledgerBalDate ou total) */
  somaTxConsiderada: number
  /** Quantidade de tx consideradas (pós-ledgerBalDate ou total) */
  txCount: number
  /** Balance ANTES da operação (do campo bank_accounts.balance) */
  saldoAntes: number
  /** Balance APÓS a operação (gravado em bank_accounts.balance) */
  saldoDepois: number
  /** Diferença = depois - antes */
  delta: number
}

/**
 * Recalcula o `balance` de UMA conta usando regra LEDGERBAL anchor.
 *
 * Multi-tenant: caller responsável por garantir que `bankAccountId` pertence
 * à empresa autorizada (rota com getAuthContext). Função pura de DB-write.
 */
export async function recalcularSaldoConta(
  prisma: PrismaClient,
  bankAccountId: string,
): Promise<RecalcResult> {
  if (!bankAccountId) {
    throw new Error('bankAccountId obrigatório')
  }

  const conta = await prisma.bankAccount.findUnique({
    where: { id: bankAccountId },
    select: {
      id: true,
      name: true,
      balance: true,
      ledgerBal: true,
      ledgerBalDate: true,
    },
  })
  if (!conta) {
    throw new Error(`Conta ${bankAccountId} não encontrada`)
  }

  const usaAnchor =
    conta.ledgerBal !== null &&
    conta.ledgerBal !== undefined &&
    conta.ledgerBalDate !== null &&
    conta.ledgerBalDate !== undefined

  // Tx pra considerar:
  //   - COM âncora: só date > ledgerBalDate
  //   - SEM âncora: todas
  const txs = await prisma.transaction.findMany({
    where: {
      bankAccountId,
      ...(usaAnchor ? { date: { gt: conta.ledgerBalDate! } } : {}),
    },
    select: {
      id: true,
      date: true,
      createdAt: true,
      type: true,
      amount: true,
      bankAccountId: true,
      transferGroupId: true,
      transferDirection: true,
    },
  })

  // Pra TRANSFER fallback (transferDirection NULL): precisamos do par completo
  // mesmo se a outra perna está em conta diferente. prepareBalanceTransactions
  // filtra por targetAccountId mas usa o array completo pra detectar direção.
  // Como buscamos só txs da conta atual, o fallback createdAt-ASC pode falhar
  // pra pares cross-account com transferDirection NULL. Sprint Fase 2 já
  // populou transferDirection em massa, então esse risco é residual.
  const rawTxs: RawBalanceTransaction[] = txs.map((t) => ({
    id: t.id,
    date: t.date,
    createdAt: t.createdAt,
    type: t.type,
    amount: t.amount,
    bankAccountId: t.bankAccountId!,
    transferGroupId: t.transferGroupId,
    transferDirection: t.transferDirection as 'OUT' | 'IN' | null,
  }))

  const signed = prepareBalanceTransactions(rawTxs, bankAccountId)
  const somaTx = signed.reduce((s, t) => s + t.signedAmount, 0)

  const saldoDepois = usaAnchor
    ? roundCents((conta.ledgerBal ?? 0) + somaTx)
    : roundCents(somaTx)

  await prisma.bankAccount.update({
    where: { id: bankAccountId },
    data: { balance: saldoDepois },
  })

  return {
    bankAccountId: conta.id,
    bankAccountName: conta.name,
    modo: usaAnchor ? 'LEDGERBAL_ANCHOR' : 'SUM_TODAS',
    ledgerBal: conta.ledgerBal,
    ledgerBalDate: conta.ledgerBalDate,
    somaTxConsiderada: roundCents(somaTx),
    txCount: signed.length,
    saldoAntes: roundCents(conta.balance),
    saldoDepois,
    delta: roundCents(saldoDepois - conta.balance),
  }
}

/**
 * Recalcula TODAS as contas de uma empresa. Retorna lista de resultados.
 * Útil pra cron / endpoint admin.
 */
export async function recalcularSaldoEmpresa(
  prisma: PrismaClient,
  companyId: string,
): Promise<RecalcResult[]> {
  const contas = await prisma.bankAccount.findMany({
    where: { companyId },
    select: { id: true },
    orderBy: { name: 'asc' },
  })
  const results: RecalcResult[] = []
  for (const c of contas) {
    results.push(await recalcularSaldoConta(prisma, c.id))
  }
  return results
}

function roundCents(n: number): number {
  return Math.round(n * 100) / 100
}
