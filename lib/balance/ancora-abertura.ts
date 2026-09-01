// ⭐⭐⭐ ÂNCORA DE ABERTURA — a decisão do dono de 01/09/2026.
//
// > *"Por que balance/ledgerBal são campos GRAVADOS a partir do que o banco declara? O
// > ledger está certo há um mês e mesmo assim a conta mostra número errado — porque o
// > saldo é uma cópia do LEDGERBAL, não uma soma do ledger. Saldo declarado pelo banco é
// > CONFERÊNCIA, não fonte."*
//
// O que muda: o saldo passa a ser `abertura conferida + Σ(nosso ledger depois dela)`, e o
// LEDGERBAL do extrato **para de sobrescrever o saldo a cada import**.
//
// ⚠️ A abertura NÃO é "o saldo que o banco mandou hoje". É uma decisão tomada UMA VEZ,
// conferida contra o extrato, com a origem escrita. As três exigências do dono:
//   (a) grava a ORIGEM (valor, data e de onde veio) e isso aparece na tela;
//   (b) mudar é EVENTO auditado (quem, quando, valor anterior) — nunca edição silenciosa;
//   (c) **dia que não fecha NÃO move a âncora sozinho.** Ela só muda por decisão do dono.
//
// ⛔ (c) é o que impede o pior modo de falha: uma conferência que "se conserta" movendo a
// régua vira uma régua que sempre fecha — o selo verde de graça que este projeto já pagou
// caro duas vezes (o invariante circular de 28/08 e o `ledgerBalMatched` de 13/08).

import type { PrismaClient, Prisma } from '@prisma/client'

type Db = PrismaClient | Prisma.TransactionClient

export interface DefinirAncoraInput {
  bankAccountId: string
  /** saldo CONTÁBIL na data (nunca o disponível — aquele já desconta bloqueio) */
  valor: number
  /** o dia da abertura: o ledger conta a partir do dia SEGUINTE */
  data: Date
  /** ex: "SALDO ANT 31/07 do PDF do Banrisul emitido 01/09 13:55" */
  origem: string
  userId?: string | null
}

export interface AncoraDefinida {
  anterior: { valor: number | null; data: Date | null }
  novo: { valor: number; data: Date }
  eventoId: string
}

/**
 * Define (ou move) a âncora de abertura, SEMPRE deixando evento.
 *
 * ⚠️ Roda numa transação: âncora e evento entram juntos ou não entram. Âncora movida sem
 * rastro é exatamente o que a exigência (b) proíbe — e o rastro é o que vai permitir
 * mover a âncora pra trás com segurança quando jun/jul forem importados certos.
 */
export async function definirAncoraDeAbertura(
  db: PrismaClient,
  input: DefinirAncoraInput,
): Promise<AncoraDefinida> {
  const conta = await db.bankAccount.findUnique({
    where: { id: input.bankAccountId },
    select: { id: true, openingBalance: true, openingDate: true },
  })
  if (!conta) throw new Error(`Conta ${input.bankAccountId} não encontrada`)

  return db.$transaction(async (tx) => {
    const ev = await tx.bankAccountOpeningEvent.create({
      data: {
        bankAccountId: input.bankAccountId,
        valorAnterior: conta.openingBalance,
        dataAnterior: conta.openingDate,
        valorNovo: input.valor,
        dataNova: input.data,
        origem: input.origem,
        userId: input.userId ?? null,
      },
    })
    await tx.bankAccount.update({
      where: { id: input.bankAccountId },
      data: { openingBalance: input.valor, openingDate: input.data, openingSource: input.origem },
    })
    return {
      anterior: { valor: conta.openingBalance, data: conta.openingDate },
      novo: { valor: input.valor, data: input.data },
      eventoId: ev.id,
    }
  })
}

/** meia-noite UTC do dia — a normalização que o `@db.Date` faria se o SQLite do dev tivesse. */
export function diaUtc(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00.000Z`)
}

export interface GravarReguaInput {
  bankAccountId: string
  origem: string
  emitidoEm: Date | null
  dias: Array<{ data: string; valor: number }>
  /** o "(+) BLOQUEADO" do momento da emissão — campo da CONTA, nunca transação */
  bloqueado?: number | null
}

/**
 * Grava a régua do PDF (um saldo contábil por dia) + o bloqueio datado.
 *
 * ⚠️ IDEMPOTENTE por (conta, dia): reimportar o mesmo PDF ATUALIZA o dia, nunca duplica —
 * e um PDF mais novo do mesmo dia corrige o antigo, que é o certo (extrato de meio-dia
 * não fecha o próprio dia).
 */
export async function gravarReguaDeclarada(db: Db, input: GravarReguaInput): Promise<number> {
  let n = 0
  for (const d of input.dias) {
    await db.bankAccountSaldoDeclarado.upsert({
      where: { bankAccountId_data: { bankAccountId: input.bankAccountId, data: diaUtc(d.data) } },
      create: {
        bankAccountId: input.bankAccountId, data: diaUtc(d.data), saldoContabil: d.valor,
        origem: input.origem, emitidoEm: input.emitidoEm,
      },
      update: { saldoContabil: d.valor, origem: input.origem, emitidoEm: input.emitidoEm },
    })
    n++
  }
  if (input.bloqueado != null) {
    await db.bankAccount.update({
      where: { id: input.bankAccountId },
      // ⚠️ DATADO: o bloqueio muda todo dia e só vale no instante do PDF. Sem a data, a
      // tela afirmaria um disponível que já não existe.
      data: { blockedAmount: input.bloqueado, blockedAt: input.emitidoEm ?? new Date() },
    })
  }
  return n
}
