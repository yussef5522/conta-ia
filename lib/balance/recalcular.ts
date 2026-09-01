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

import type { PrismaClient, Prisma } from '@prisma/client'
import { prepareBalanceTransactions, type RawBalanceTransaction } from './prepare'

// Aceita tanto o client global quanto um TransactionClient — pra rodar DENTRO do
// mesmo prisma.$transaction do import (saldo consistente com as tx no mesmo commit).
type DbClient = PrismaClient | Prisma.TransactionClient

// FIX movimento futuro (07/08). No modo âncora, SÓ movimento EFETIVADO entra no
// saldo realizado — agendado (PAYABLE/RECEIVABLE com date > âncora) NÃO é saldo,
// senão o saldo infla (Banrisul caçula: -21.576,73 em vez do LEDGERBAL -6.178,45).
export function contaNoSaldoRealizado(lifecycle: string | null | undefined): boolean {
  // EFFECTED = realizou (entrou/saiu de fato). PAYABLE/RECEIVABLE = agendado.
  // null/legado tratado como realizado (histórico antes do campo lifecycle).
  return lifecycle == null || lifecycle === 'EFFECTED'
}

/**
 * Núcleo PURO do cálculo de saldo — sem DB, testável direto no suite.
 * ANCHOR: ledgerBal + Σ(signed de tx REALIZADAS após a âncora). Agendado fora.
 * SUM_TODAS: Σ(signed de TODAS) — caixa físico/manual (sem âncora do banco).
 */
export function calcularSaldo(params: {
  ledgerBal: number | null
  usaAnchor: boolean
  txs: Array<RawBalanceTransaction & { lifecycle?: string | null }>
  bankAccountId: string
}): { saldo: number; txConsideradas: number; somaTx: number } {
  const { ledgerBal, usaAnchor, txs, bankAccountId } = params
  const considerar = usaAnchor ? txs.filter((t) => contaNoSaldoRealizado(t.lifecycle)) : txs
  const signed = prepareBalanceTransactions(considerar, bankAccountId)
  const somaTx = roundCents(signed.reduce((s, t) => s + t.signedAmount, 0))
  const saldo = usaAnchor ? roundCents((ledgerBal ?? 0) + somaTx) : somaTx
  return { saldo, txConsideradas: signed.length, somaTx }
}

export interface RecalcResult {
  bankAccountId: string
  bankAccountName: string
  modo: 'ABERTURA_CONFERIDA' | 'LEDGERBAL_ANCHOR' | 'SUM_TODAS'
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
  prisma: DbClient,
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
      openingBalance: true,
      openingDate: true,
    },
  })
  if (!conta) {
    throw new Error(`Conta ${bankAccountId} não encontrada`)
  }

  // ⭐⭐ ÂNCORA DE ABERTURA (01/09/2026) — "saldo declarado pelo banco é CONFERÊNCIA, não
  // fonte" (dono). Quando a conta tem `openingBalance`, o saldo passa a ser derivado do
  // NOSSO ledger a partir dela, e o LEDGERBAL do extrato deixa de mandar.
  //
  // ⚠️⚠️ POR QUE O CAMINHO É CONDICIONAL, e não uma troca geral: **`Σ(ledger)` puro NÃO
  // serve pra toda conta.** Medido no Banrisul da Caçula em 01/09: Σ(482 tx) = −134.769,26
  // contra o contábil real de −4.567,03 — **erro de −130.202,23, inteiro em jun/jul**
  // (a conta provavelmente nasceu sem abertura). Derivar tudo do ledger deixaria a conta
  // 130 mil PIOR que o modo âncora. Por isso a abertura é uma decisão DELIBERADA por
  // conta, conferida contra o extrato, e quem não tem segue exatamente como antes —
  // cofre e banco caixa não sentem nada.
  //
  // ⛔ E dia que não fecha NUNCA move a âncora: ela só muda por decisão do dono, com
  // evento em `BankAccountOpeningEvent`.
  const usaAbertura =
    conta.openingBalance !== null &&
    conta.openingBalance !== undefined &&
    conta.openingDate !== null &&
    conta.openingDate !== undefined

  const usaAnchor =
    !usaAbertura &&
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
      ...(usaAbertura
        ? { date: { gt: conta.openingDate! } }
        : usaAnchor
          ? { date: { gt: conta.ledgerBalDate! } }
          : {}),
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
      lifecycle: true,
    },
  })

  // Pra TRANSFER fallback (transferDirection NULL): precisamos do par completo
  // mesmo se a outra perna está em conta diferente. prepareBalanceTransactions
  // filtra por targetAccountId mas usa o array completo pra detectar direção.
  // Como buscamos só txs da conta atual, o fallback createdAt-ASC pode falhar
  // pra pares cross-account com transferDirection NULL. Sprint Fase 2 já
  // populou transferDirection em massa, então esse risco é residual.
  const rawTxs: Array<RawBalanceTransaction & { lifecycle?: string | null }> = txs.map((t) => ({
    id: t.id,
    date: t.date,
    createdAt: t.createdAt,
    type: t.type,
    amount: t.amount,
    bankAccountId: t.bankAccountId!,
    transferGroupId: t.transferGroupId,
    transferDirection: t.transferDirection as 'OUT' | 'IN' | null,
    lifecycle: t.lifecycle,
  }))

  // Cálculo puro (testável): no modo âncora filtra agendado (só EFFECTED soma).
  const calc = calcularSaldo({
    ledgerBal: usaAbertura ? conta.openingBalance : conta.ledgerBal,
    usaAnchor: usaAbertura || usaAnchor,
    txs: rawTxs,
    bankAccountId,
  })
  const somaTx = calc.somaTx
  const saldoDepois = calc.saldo

  await prisma.bankAccount.update({
    where: { id: bankAccountId },
    data: { balance: saldoDepois },
  })

  return {
    bankAccountId: conta.id,
    bankAccountName: conta.name,
    modo: usaAbertura ? 'ABERTURA_CONFERIDA' : usaAnchor ? 'LEDGERBAL_ANCHOR' : 'SUM_TODAS',
    ledgerBal: conta.ledgerBal,
    ledgerBalDate: conta.ledgerBalDate,
    somaTxConsiderada: roundCents(somaTx),
    txCount: calc.txConsideradas,
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
