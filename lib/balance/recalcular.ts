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
import { depoisDaAncora } from './ancora-abertura'

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
  /**
   * ⛔⛔⛔ A PONTA CONCILIADA FICA FORA — achado ao provar em prod (30/09/2026).
   *
   * **O caso:** o Banrisul tinha `balance −13.531,57` (CERTO) e a derivação dava
   * `−12.815,17` — **716,40 a mais**. A causa: uma venda de R$ 716,40 lançada à mão e
   * **conciliada com a linha do extrato** do mesmo valor. São o MESMO dinheiro em duas
   * linhas (conta a pagar/receber é uma `Transaction`, então conciliar deixa a ex-payable
   * e a linha do banco convivendo) — e somar as duas conta o dinheiro duas vezes.
   *
   * ⚠️⚠️ E A RÉGUA JÁ EXISTIA EM OUTRO LUGAR: `lib/balance/ler-conferencia.ts` filtra
   * `reconciledWithId: null` desde 29/09, com o comentário *"o saldo e o fluxo já
   * descontavam a conciliada; o B1 não"*. Ou seja — **esta função era o QUARTO leitor da
   * pergunta "o que conta como caixa?", e o único com a régua errada.** O cache escondia
   * isso porque o `increment` nunca somava as duas pontas; ao trocar por derivação, o
   * defeito velho apareceu de cara. *Uma decisão, um lugar* — e aqui faltava um `where`.
   */
  const txs = await prisma.transaction.findMany({
    where: {
      bankAccountId,
      reconciledWithId: null,
      ...(usaAbertura
        // ⛔ `gte` no DIA SEGUINTE, não `gt` na âncora: o dia da âncora inteiro já está
        // dentro do saldo declarado (ver `depoisDaAncora`).
        ? { date: { gte: depoisDaAncora(conta.openingDate!) } }
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

// ═══════════════════════════════════════════════════════════════════════════════
// ⭐⭐⭐ MATAR A CLASSE DO DRIFT (30/09/2026) — `re-ancorar` é a porta ÚNICA.
//
// ⛔⛔ O QUE ACONTECEU: a Stone ficou com o `balance` gravado 2.112,00 acima da régua, e o
// import cuspiu *"saldo previsto 2.199,53 × extrato 87,53 · causa não identificada"* + um
// aviso fóssil de 13-17/08 — mandando o dono caçar AGOSTO por um drift de ANTEONTEM.
//
// A causa não era o extrato: era **uma venda em dinheiro de R$ 2.112,00 lançada à mão com
// data 17/09 e criada em 28/09**. O `POST /api/transacoes` fazia `balance: { increment }`,
// e 17/09 já estava DENTRO do saldo que o banco declarou em 25/09 → o dinheiro entrou
// duas vezes no cache.
//
// ⚠️ O sprint "o banco é a lei" (17/06) matou o drift NO IMPORT e deixou vivo em ~20 portas
// (lançamento manual, edição, efetivar, contas a pagar, transferência, ponte, Pluggy,
// ajustar-saldo, PF). **Increment só coincide com a régua quando a data do lançamento é
// POSTERIOR à âncora** — todo lançamento retroativo drifta, e drift de cache é invisível
// até alguém importar o extrato seguinte.
//
// ⭐ A CURA É REGRA 5: a porta não existe mais. Em vez de somar o delta, a operação
// TERMINA re-derivando o saldo pela régua da casa. O drift deixa de ser improvável e passa
// a ser IMPOSSÍVEL — não há o que driftar quando ninguém guarda delta.
//
// ⚠️ E ela é IDEMPOTENTE de propósito: chamar duas vezes dá o mesmo número (é derivação,
// não acumulação). Isso é o que permite chamá-la no fim de qualquer gesto sem medo.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Re-ancora N contas de uma vez, no fim de um gesto. Ignora `null`/`undefined` e repetidas
 * (mover uma linha entre duas contas pede as duas; um lançamento simples pede uma).
 *
 * ⚠️ Recebe o client TRANSACIONAL: o saldo tem que ficar consistente no MESMO commit que
 * criou/moveu/apagou a linha. Fora da transação, uma falha no meio deixaria a linha
 * gravada e o saldo velho — o estado pela metade que este módulo existe pra não ter.
 */
export async function reAncorarContas(
  db: DbClient,
  bankAccountIds: Array<string | null | undefined>,
): Promise<RecalcResult[]> {
  const ids = [...new Set(bankAccountIds.filter((x): x is string => !!x))]
  const out: RecalcResult[] = []
  for (const id of ids) out.push(await recalcularSaldoConta(db, id))
  return out
}

export interface RecalcResultPF {
  personalBankAccountId: string
  modo: 'ABERTURA_CONFERIDA' | 'LEDGERBAL_ANCHOR' | 'SUM_TODAS'
  saldoAntes: number
  saldoDepois: number
  delta: number
  txCount: number
}

/**
 * ⭐ O MESMO para conta de PERFIL (PF). **Não é uma segunda fórmula** — o núcleo puro
 * (`calcularSaldo`) é o MESMO; o que muda é a tabela de onde as linhas vêm.
 *
 * ⚠️ A PF ganhou `ledgerBal`/`ledgerBalDate` na FASE 1 (13/09), então ela tem âncora e
 * sofre do MESMO drift: lançamento retroativo com `increment` soma por cima do saldo que
 * o banco já declarou. Sem este irmão, o item 4 deixaria metade da casa curada.
 *
 * ⛔ `PersonalTransaction` **não tem `lifecycle`** (registrado desde 07/08: no PF a linha
 * nasce sempre realizada) e **não tem TRANSFER entre contas** — por isso o array vai com
 * `lifecycle: 'EFFECTED'` e `transferGroupId: null`, que é a verdade do modelo, não um
 * atalho. No dia em que o PF ganhar `lifecycle`, o filtro do núcleo passa a valer de graça.
 */
export async function recalcularSaldoContaPF(
  db: DbClient,
  personalBankAccountId: string,
): Promise<RecalcResultPF> {
  if (!personalBankAccountId) throw new Error('personalBankAccountId obrigatório')

  const conta = await db.personalBankAccount.findUnique({
    where: { id: personalBankAccountId },
    select: {
      id: true, balance: true, ledgerBal: true, ledgerBalDate: true,
      openingBalance: true, openingDate: true,
    },
  })
  if (!conta) throw new Error(`Conta PF ${personalBankAccountId} não encontrada`)

  /**
   * ⭐⭐ ABERTURA CONFERIDA MANDA (30/09/2026), igual ao PJ — e é ela que impede a derivação
   * de zerar conta criada com saldo DIGITADO. Sem esta metade, `Σ(tx)` de uma conta nova
   * seria ZERO e o primeiro lançamento apagaria a abertura em silêncio: a mina registrada
   * neste projeto desde 31/07, que no PF estava viva porque o modelo não tinha o par.
   */
  const usaAbertura = conta.openingBalance != null && conta.openingDate != null
  const usaAnchor = !usaAbertura && conta.ledgerBal != null && conta.ledgerBalDate != null

  const txs = await db.personalTransaction.findMany({
    where: {
      bankAccountId: personalBankAccountId,
      ...(usaAbertura
        // ⛔ `gte` no DIA SEGUINTE (o dia da âncora inteiro já está dentro dela) — a mesma
        // régua do PJ, pelo MESMO helper. Duas contagens de "depois da âncora" divergiriam.
        ? { date: { gte: depoisDaAncora(conta.openingDate!) } }
        : usaAnchor
          ? { date: { gt: conta.ledgerBalDate! } }
          : {}),
    },
    select: { id: true, date: true, createdAt: true, type: true, amount: true, bankAccountId: true },
  })

  const calc = calcularSaldo({
    ledgerBal: usaAbertura ? conta.openingBalance : conta.ledgerBal,
    usaAnchor: usaAbertura || usaAnchor,
    txs: txs.map((t) => ({
      id: t.id,
      date: t.date,
      createdAt: t.createdAt,
      type: t.type,
      amount: t.amount,
      bankAccountId: t.bankAccountId!,
      transferGroupId: null,
      transferDirection: null,
      lifecycle: 'EFFECTED',
    })),
    bankAccountId: personalBankAccountId,
  })

  await db.personalBankAccount.update({
    where: { id: personalBankAccountId },
    data: { balance: calc.saldo },
  })

  return {
    personalBankAccountId,
    modo: usaAbertura ? 'ABERTURA_CONFERIDA' : usaAnchor ? 'LEDGERBAL_ANCHOR' : 'SUM_TODAS',
    saldoAntes: roundCents(conta.balance),
    saldoDepois: calc.saldo,
    delta: roundCents(calc.saldo - conta.balance),
    txCount: calc.txConsideradas,
  }
}

/** Irmã do `reAncorarContas` pro PF. */
export async function reAncorarContasPF(
  db: DbClient,
  ids: Array<string | null | undefined>,
): Promise<RecalcResultPF[]> {
  const unicos = [...new Set(ids.filter((x): x is string => !!x))]
  const out: RecalcResultPF[] = []
  for (const id of unicos) out.push(await recalcularSaldoContaPF(db, id))
  return out
}
