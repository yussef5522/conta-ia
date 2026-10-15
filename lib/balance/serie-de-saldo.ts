/**
 * ⭐⭐⭐ NO CAIXA AGORA + OS 30 DIAS — a porta do módulo 1 da mesa de operações (15/10/2026).
 *
 * **O que ela responde:** *"quanto eu tenho agora, e como esse número chegou aqui"* — o número
 * grande, a linha dos 30 dias com scrub, e o entrou/saiu de HOJE.
 *
 * ⛔⛔ **O SALDO DE HOJE NÃO É RECALCULADO AQUI.** Ele é a Σ do `bankAccount.balance` das contas
 * de caixa, pelo **dono único** (`totalDasContas`) — exatamente o número que o card de `/contas`
 * mostra. ⚠️ Somar de outro jeito faria a mesa e a tela de Contas exibirem dois "saldo total"
 * diferentes na mesma sessão, e o dono não teria como saber qual acreditar.
 *
 * ⭐⭐ **A SÉRIE ANDA PRA TRÁS A PARTIR DE HOJE, nunca pra frente do zero.** O `balance` já é
 * ancorado (`openingBalance`/`ledgerBal` + Σ pós-âncora, a lei de 30/09); reconstruir do zero
 * somando o ledger inteiro daria **−130.202,23** de diferença no Banrisul, que é a mina
 * registrada desde 31/07 (*"o modelo não separa ABERTURA de MOVIMENTO"*). Andando pra trás, a
 * âncora é respeitada por construção.
 *
 * ⚠️ **E a régua do que conta como caixa é a de `regua-do-caixa.ts`** — a pergunta que já teve
 * 4 leitores, um deles contando aluguel duas vezes. Zero `where` novo aqui.
 *
 * ⭐ **Transferência entre contas próprias se cancela de graça:** a série é CONSOLIDADA, então a
 * perna `OUT` de uma conta e a `IN` da outra somam zero no mesmo dia. Nenhum tratamento
 * especial — e é por isso que a linha não pula quando o dono move dinheiro entre bancos.
 */
import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { totalDasContas } from './destaque-do-card'
import { WHERE_CAIXA, sinalDoCaixa, ehContaDeCaixa } from './regua-do-caixa'

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100
const diaUtc = (d: Date) => d.toISOString().slice(0, 10)

export interface PontoDoSaldo {
  /** YYYY-MM-DD */
  dia: string
  saldo: number
}

export interface SerieDeSaldo {
  /** o número GRANDE — a Σ do contábil das contas de caixa */
  saldoAgora: number
  /** quantas contas entraram na Σ (o dono clica e vê quais) */
  contas: number
  /** do mais ANTIGO pro mais recente; o último ponto é `saldoAgora` */
  pontos: PontoDoSaldo[]
  /** o movimento de HOJE, separado — é o que a sublinha mostra */
  hoje: { entrou: number; saiu: number }
  /**
   * ⚠️ `true` quando a série alcança o começo da janela pedida. `false` significa que a
   * empresa não tem 30 dias de história — e a tela DIZ isso em vez de desenhar uma linha
   * que começa no nada.
   */
  janelaCompleta: boolean
}

export interface OpcoesDaSerie {
  /** quantos dias a linha mostra (contando hoje) */
  dias?: number
}

/**
 * ⚠️ `agora` é PARÂMETRO — o relógio só serve pra dizer que dia é hoje na TELA, nunca pra
 * decidir (a régua da casa desde 13/08). E o dia é o **dia do BRASIL**: às 23h de São Paulo o
 * servidor em UTC já diz amanhã, e a linha inteira deslizaria um dia (a cicatriz do card do
 * cartão e do Contas a Pagar).
 */
export async function serieDeSaldo(
  companyId: string,
  opts: OpcoesDaSerie = {},
  agora: Date = new Date(),
  db: PrismaClient = defaultPrisma,
): Promise<SerieDeSaldo> {
  const dias = Math.max(2, opts.dias ?? 30)

  const contas = await db.bankAccount.findMany({
    where: { companyId },
    select: { id: true, accountType: true, balance: true },
  })
  const deCaixa = contas.filter(ehContaDeCaixa)
  const saldoAgora = totalDasContas(deCaixa.map((c) => ({ contabil: c.balance })))

  // ⭐ o dia do BRASIL (UTC−3), nunca o do servidor
  const hojeBr = new Date(agora.getTime() - 3 * 3600_000)
  const hoje = diaUtc(hojeBr)
  const primeiro = diaUtc(new Date(hojeBr.getTime() - (dias - 1) * 86400_000))

  if (deCaixa.length === 0) {
    return { saldoAgora: 0, contas: 0, pontos: [], hoje: { entrou: 0, saiu: 0 }, janelaCompleta: false }
  }

  /**
   * ⚠️ A JANELA PEGA **UM DIA A MAIS PRA TRÁS** de propósito: pra saber se a empresa tem
   * história ANTES do início da linha. Sem isso, a 1ª semana de uso desenharia uma linha
   * saindo do zero como se o dinheiro tivesse nascido ali.
   */
  const desde = new Date(`${primeiro}T00:00:00.000Z`)
  const txs = await db.transaction.findMany({
    where: {
      bankAccountId: { in: deCaixa.map((c) => c.id) },
      ...WHERE_CAIXA,
      date: { gte: desde },
    },
    select: { date: true, amount: true, type: true, transferDirection: true },
  })

  const temHistoriaAntes =
    (await db.transaction.count({
      where: { bankAccountId: { in: deCaixa.map((c) => c.id) }, ...WHERE_CAIXA, date: { lt: desde } },
    })) > 0

  // Σ assinada por dia
  const porDia = new Map<string, number>()
  let entrou = 0
  let saiu = 0
  for (const t of txs) {
    const d = diaUtc(t.date)
    const v = sinalDoCaixa(t) * t.amount
    porDia.set(d, (porDia.get(d) ?? 0) + v)
    if (d === hoje) {
      if (v >= 0) entrou += v
      else saiu += -v
    }
  }

  /**
   * ⭐⭐ ANDA PRA TRÁS: o saldo de ontem é o de hoje MENOS o que se moveu hoje. É a mesma
   * derivação da coluna SALDO do histórico do item (11/09) — e o invariante que ela carrega é
   * o mesmo: **o último ponto É o saldo de agora**, então a linha e o número grande não têm
   * como divergir.
   */
  const pontos: PontoDoSaldo[] = []
  let saldo = saldoAgora
  for (let i = 0; i < dias; i++) {
    const d = diaUtc(new Date(hojeBr.getTime() - i * 86400_000))
    pontos.unshift({ dia: d, saldo: round2(saldo) })
    saldo -= porDia.get(d) ?? 0
  }

  return {
    saldoAgora,
    contas: deCaixa.length,
    pontos,
    hoje: { entrou: round2(entrou), saiu: round2(saiu) },
    janelaCompleta: temHistoriaAntes,
  }
}
