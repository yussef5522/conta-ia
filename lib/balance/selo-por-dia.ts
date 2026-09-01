// ⭐⭐ O SELO É POR DIA, NUNCA PELA CONTA (decisão do dono, 01/09/2026).
//
// > *"'conferido' é por DIA, nunca pela conta inteira. Agosto verde e setembro sem selo é
// > o honesto."*
//
// ⚠️ E o selo é DERIVADO na hora, nunca gravado: ele compara a régua declarada
// (`bank_account_saldo_declarado`, lida do PDF) com o ledger de agora. Selo gravado
// envelhece — bastaria alguém apagar uma transação pra a conta continuar "conferida".
//
// ⛔ E ele NÃO move a âncora quando um dia não fecha (exigência (c) do dono). Régua que se
// ajusta pra fechar é régua que sempre fecha, e aí o verde não significa nada.

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { prepareBalanceTransactions } from './prepare'
import { contaNoSaldoRealizado } from './recalcular'
import { depoisDaAncora } from './ancora-abertura'
import { conferirDiaADia, type LancamentoSistema, type ResultadoConferencia } from '../bank-statement-pdf/conferencia-diaria'

export interface SeloDaConta {
  bankAccountId: string
  conferivel: boolean
  motivo: string | null
  diasConferidos: number
  diasQueFecham: number
  /** o primeiro dia que não fecha — a pergunta que leva a uma ação */
  primeiroQueNaoFecha: { data: string; diferenca: number } | null
  /** período coberto pela régua do PDF */
  cobertura: { de: string; ate: string } | null
  /** o contábil mais recente declarado (o número que a conta deve mostrar) */
  contabilDeclarado: { data: string; valor: number } | null
  /** o bloqueio, DATADO — só vale no instante do PDF */
  bloqueio: { valor: number; em: string } | null
  /** de onde a âncora veio, pra tela mostrar */
  aberturaOrigem: string | null
  detalhe: ResultadoConferencia | null
}

const iso = (d: Date) => d.toISOString().slice(0, 10)

/**
 * Confere UMA conta dia a dia contra a régua declarada.
 *
 * ⚠️ Só há o que conferir se a conta tem ÂNCORA DE ABERTURA e régua. Sem isso devolve
 * `conferivel: false` **com o motivo escrito** — nunca um verde vazio, que é pior que
 * nenhum selo (foi assim que o 🟢 da Focatto significou "não olhei").
 */
export async function seloPorDiaDaConta(
  bankAccountId: string,
  db: PrismaClient = defaultPrisma,
): Promise<SeloDaConta> {
  const conta = await db.bankAccount.findUnique({
    where: { id: bankAccountId },
    select: { id: true, openingBalance: true, openingDate: true, openingSource: true, blockedAmount: true, blockedAt: true },
  })
  const vazio: SeloDaConta = {
    bankAccountId, conferivel: false, motivo: null, diasConferidos: 0, diasQueFecham: 0,
    primeiroQueNaoFecha: null, cobertura: null, contabilDeclarado: null,
    bloqueio: conta?.blockedAmount != null && conta.blockedAt
      ? { valor: conta.blockedAmount, em: conta.blockedAt.toISOString() } : null,
    aberturaOrigem: conta?.openingSource ?? null, detalhe: null,
  }
  if (!conta) return { ...vazio, motivo: 'conta não encontrada' }

  const declarados = await db.bankAccountSaldoDeclarado.findMany({
    where: { bankAccountId }, orderBy: { data: 'asc' },
    select: { data: true, saldoContabil: true },
  })
  if (!declarados.length) {
    return { ...vazio, motivo: 'sem extrato PDF — o OFX do Banrisul desconta bloqueio, então o saldo dele não serve de régua' }
  }
  if (conta.openingBalance == null || conta.openingDate == null) {
    return { ...vazio, motivo: 'a conta ainda não tem abertura conferida' }
  }

  const txs = await db.transaction.findMany({
    where: { bankAccountId, date: { gte: depoisDaAncora(conta.openingDate) } },
    select: { id: true, date: true, createdAt: true, type: true, amount: true, bankAccountId: true,
      transferGroupId: true, transferDirection: true, lifecycle: true, description: true },
  })
  const realizadas = txs.filter((t) => contaNoSaldoRealizado(t.lifecycle))
  // ⚠️ o sinal vem de `prepareBalanceTransactions` — a MESMA função do saldo. Uma segunda
  // régua de sinal aqui faria a conferência discordar do próprio saldo que ela confere.
  const signed = prepareBalanceTransactions(realizadas as never, bankAccountId)
  const porId = new Map(realizadas.map((t) => [t.id, t.description ?? '']))
  const lancamentos: LancamentoSistema[] = signed.map((s) => ({
    id: s.id, data: iso(s.date), valor: s.signedAmount, descricao: porId.get(s.id) ?? '',
  }))

  const r = conferirDiaADia(
    {
      saldoAnterior: { data: iso(conta.openingDate), valor: conta.openingBalance },
      saldosDiarios: declarados.map((d) => ({ data: iso(d.data), valor: d.saldoContabil })),
    },
    lancamentos,
  )

  const ult = declarados[declarados.length - 1]
  return {
    ...vazio,
    conferivel: r.conferivel,
    motivo: r.motivoNaoConferivel,
    diasConferidos: r.dias.length,
    diasQueFecham: r.dias.filter((d) => d.fecha).length,
    primeiroQueNaoFecha: r.primeiroQueNaoFecha
      ? { data: r.primeiroQueNaoFecha.data, diferenca: r.primeiroQueNaoFecha.diferenca }
      : null,
    cobertura: { de: iso(declarados[0].data), ate: iso(ult.data) },
    contabilDeclarado: { data: iso(ult.data), valor: ult.saldoContabil },
    detalhe: r,
  }
}
