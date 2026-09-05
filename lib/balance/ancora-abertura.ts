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

/**
 * ⛔⛔ O DIA DA ÂNCORA INTEIRO FICA DE FORA — e isto é bug pego EM PRODUÇÃO (01/09/2026).
 *
 * "SALDO ANT EM 31/07" já contém **tudo até o fim de 31/07**. O filtro era
 * `date > openingDate`, com a âncora em `31/07 00:00Z` — e o sistema grava as transações
 * ao **MEIO-DIA UTC** (convenção do projeto pra não virar o dia por fuso). Resultado: as
 * **10 tx de 31/07 12:00 entravam de novo**, e o saldo saiu −4.662,10 em vez de −4.567,03,
 * errado em exatamente **−95,07** = a soma delas.
 *
 * ⚠️ E o teste não pegou porque usava meia-noite — fixture idealizada escondendo a
 * convenção real do banco de dados. Quem pegou foi o dado de produção.
 */
export function depoisDaAncora(openingDate: Date): Date {
  const d = new Date(openingDate)
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() + 1)
  return d
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
export interface ReguaReescrita {
  data: string
  /** o que o banco declarava ANTES (PDF anterior) */
  de: number
  /** o que ele declara AGORA */
  para: number
  /** para − de */
  diferenca: number
}

export interface ResultadoDaRegua {
  gravados: number
  /** ⭐ dias em que o banco MUDOU o que já tinha declarado — ver `reescritaDoBanco` */
  reescritos: ReguaReescrita[]
}

export async function gravarReguaDeclarada(db: Db, input: GravarReguaInput): Promise<ResultadoDaRegua> {
  // ⭐⭐ O BANCO REESCREVE O PASSADO (05/09/2026) — e isso tem que APARECER.
  // O PDF de 01/09 dizia `SALDO ANT EM 31/08 = −7.353,66`; o de 05/09 diz **−8.130,19**.
  // São R$ 776,53 que o Banrisul postou em AGOSTO **depois do fato** (a família do
  // "+24hs / re-publicação"). Sobrescrever calado apagaria a única evidência de que o
  // fechamento mudou — e o dono descobriria pelo saldo, meses depois.
  const jaGravados = await db.bankAccountSaldoDeclarado.findMany({
    where: { bankAccountId: input.bankAccountId },
    select: { data: true, saldoContabil: true, emitidoEm: true },
  })
  const antes = new Map(jaGravados.map((g) => [g.data.toISOString().slice(0, 10), g]))
  const reescritos: ReguaReescrita[] = []
  const atualizados: ReguaReescrita[] = []
  for (const d of input.dias) {
    const anterior = antes.get(d.data)
    if (anterior == null || Math.abs(anterior.saldoContabil - d.valor) <= 0.005) continue
    const mudou: ReguaReescrita = {
      data: d.data, de: anterior.saldoContabil, para: d.valor,
      diferenca: Math.round((d.valor - anterior.saldoContabil) * 100) / 100,
    }
    // ⭐⭐ REESCRITA × EXPORT DE MEIO-DIA — e a diferença é a HORA DE EMISSÃO da declaração
    // anterior, que já estava gravada.
    //
    // ⛔ Sem esta separação o aviso inflava: na 1ª rodada ele somou o 01/09 (que mudou de
    // −3.225,96 pra −5.148,51) ao 31/08 e anunciou **R$ 2.699,08** de "reescrita" — mas o
    // PDF anterior fora emitido às **14:01 do próprio dia 01/09**, ou seja **no meio do
    // dia**, antes dos encargos existirem. Aquele número nunca foi o fechamento do dia;
    // era um parcial, e atualizá-lo é o esperado (a mania nº 6 do catálogo do Banrisul).
    //
    // ⚠️ REESCRITA DE VERDADE é o dia cuja declaração anterior foi emitida **depois do fim
    // daquele dia** — já era o fechamento definitivo, e o banco o mudou. É o 31/08, com os
    // R$ 776,53 que o dono mediu.
    const declaradoDepoisDoDia = anterior.emitidoEm
      ? anterior.emitidoEm.toISOString().slice(0, 10) > d.data
      : true // sem hora de emissão, o conservador é tratar como fechamento
    if (declaradoDepoisDoDia) reescritos.push(mudou)
    else atualizados.push(mudou)
  }
  if (atualizados.length) {
    console.log('[régua] parciais atualizados (export de meio-dia, esperado):',
      atualizados.map((a) => `${a.data} ${a.de}→${a.para}`).join(' · '))
  }

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
  return { gravados: n, reescritos }
}

/**
 * A frase que a tela mostra quando o banco reescreveu um fechamento já declarado.
 *
 * ⛔ **NÃO MEXE NO LEDGER NO CHUTE** (ordem do dono): a régua registra o que o banco diz
 * HOJE; achar quais linhas ele acrescentou exige o extrato daquele mês. A frase pede
 * exatamente isso, em vez de deixar um vermelho sem saída.
 */
export function reescritaDoBanco(rs: ReguaReescrita[]): string | null {
  if (!rs.length) return null
  const brl = (n: number) => Math.abs(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
  const partes = rs.map((r) => `${r.data.split('-').reverse().join('/')} de ${brl(r.de)} pra ${brl(r.para)} (${brl(r.diferenca)})`)
  const mesesUnicos = [...new Set(rs.map((r) => MES[Number(r.data.slice(5, 7)) - 1]))]
  return `O banco reescreveu o fechamento de ${mesesUnicos.join(' e ')} em ${brl(rs.reduce((s, r) => s + Math.abs(r.diferenca), 0))}: `
    + `${partes.join(' · ')}. São lançamentos que ele postou depois do fato. `
    + `Traga o extrato de ${mesesUnicos.join('/').toUpperCase()} atualizado pra a conferência diária localizar exatamente quais linhas ele acrescentou.`
}
