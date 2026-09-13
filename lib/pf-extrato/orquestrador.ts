// ⭐⭐⭐ O ORQUESTRADOR DO EXTRATO PF (13/09/2026) — FINO, de propósito.
//
// **A investigação mandou:** *"orquestrador PF FINO reusando a camada de baixo (parser,
// dedup, perfil de banco, descarte de futuro) — sem gatilho de vendas/DRE/conciliação PJ."*
//
// ⛔ **Por que não dá pra apontar o `runImportV2` da PJ pro perfil:** ele escreve em
// `Transaction`/`BankAccount`, dispara `recomputeVendasSafe`, alimenta a conciliação e o DRE
// — nada disso existe no PF, e forçar criaria acoplamento entre dois mundos que o dono exige
// separados. ⭐ O que se reusa é a camada de BAIXO, que não sabe de empresa nenhuma:
// `parseOFX` · `stableKey` · `resolveBankProfile` · `partitionFutureLines`.
//
// ⚠️ E a trava de conta errada (`verifyOfxMatchesAccount`) **nasce junto** — é ela que em
// 12/08 impediu 355 tx do Sicredi de entrarem na conta Stone. Import PF não vai ao ar sem
// a proteção que a PJ tem.

import { parseOFX } from '@/lib/ofx/parser'
import { verifyOfxMatchesAccount } from '@/lib/ofx/verify-account-match'
import { resolveBankProfile, podeConferirPorLedgerbal } from '@/lib/bank-profiles'
import { partitionFutureLines, settledThroughDate } from '@/lib/ofx/future-line'
import { planoDoExtrato, type LinhaDoExtrato, type TxExistente } from './casar-com-existente'
import { conferirSaldo, reconhecerPagamentoDeFatura, ehAmbiguo, type FaturaAberta } from './conferencia-e-fatura'

export interface ContaPF {
  id: string
  name: string
  bankCode: string | null
  bankName: string | null
  accountNumber: string | null
  balance: number
  ledgerBal: number | null
  ledgerBalDate: Date | null
}

export interface PreviewDoExtratoPF {
  /** ⛔ bloqueia o import: o arquivo é de outra conta */
  bloqueio: { erro: string; code: string } | null
  /** ⚠️ não deu pra conferir a conta — avisa, nunca bloqueia (a régua de 12/08) */
  aviso: string | null
  /**
   * ⭐ o 1º import da conta PROPÕE gravar o que identifica ela. Sem `bankCode`/
   * `accountNumber` a trava não tem o que comparar — e o dono não deveria ter que
   * cadastrar à mão o que o arquivo já diz.
   */
  aprender: { bankCode: string | null; accountNumber: string | null } | null
  banco: { id: string | null; rotulo: string; conhecido: boolean }
  periodo: { de: string | null; ate: string | null }
  novas: LinhaDoExtrato[]
  jaImportadas: number
  casadas: { linha: LinhaDoExtrato; txId: string; temPonte: boolean; porQue: string }[]
  ambiguas: { linha: LinhaDoExtrato; candidatos: string[]; porQue: string }[]
  /** linhas que o banco listou e ainda não debitou — fora do import, com o motivo */
  agendadas: { linha: LinhaDoExtrato; porQue: string }[]
  conferencia: ReturnType<typeof conferirSaldo>
  /** ⭐ os débitos que se reconhecem como pagamento de fatura */
  pagamentosDeFatura: { fitid: string; invoiceId: string; cardId: string; cardNome: string; porQue: string }[]
  /** ⚠️ os que têm mais de uma fatura possível — o dono aponta */
  pagamentosAmbiguos: { fitid: string; faturas: { invoiceId: string; cardNome: string }[] }[]
  erros: string[]
}

/** ⭐ a linha do OFX vira a forma que o resto entende (sinal no valor, não no tipo) */
function paraLinha(t: { fitid: string; datePosted: Date; amount: number; type: 'CREDIT' | 'DEBIT'; memo: string }): LinhaDoExtrato {
  return {
    fitid: t.fitid, data: t.datePosted, memo: t.memo,
    // ⚠️ o SINAL mora no valor daqui pra frente: foi confundir sinal com tipo que produziu
    // a duplicata do PIX de 7.000 em 17/08
    valorComSinal: t.type === 'CREDIT' ? Math.abs(t.amount) : -Math.abs(t.amount),
  }
}

export function previewDoExtratoPF(input: {
  raw: string
  conta: ContaPF
  existentes: TxExistente[]
  faturas: FaturaAberta[]
}): PreviewDoExtratoPF {
  const p = parseOFX(input.raw)
  const perfil = resolveBankProfile(p.bankId ?? input.conta.bankCode ?? null)

  // 1 ── A TRAVA DA CONTA ERRADA, antes de qualquer outra coisa
  const match = verifyOfxMatchesAccount(
    { bankId: p.bankId, accountId: p.accountId },
    { bankCode: input.conta.bankCode, bankName: input.conta.bankName, accountNumber: input.conta.accountNumber, name: input.conta.name })

  const vazio: PreviewDoExtratoPF = {
    bloqueio: null, aviso: null, aprender: null,
    banco: { id: p.bankId ?? null, rotulo: perfil?.displayName ?? (p.bankId ? `banco ${p.bankId}` : 'não identificado'), conhecido: !!perfil },
    periodo: { de: null, ate: null },
    novas: [], jaImportadas: 0, casadas: [], ambiguas: [], agendadas: [],
    conferencia: conferirSaldo({ saldoAntes: input.conta.balance, entram: [], declarado: null }),
    pagamentosDeFatura: [], pagamentosAmbiguos: [], erros: p.errors,
  }
  if (match.block) return { ...vazio, bloqueio: { erro: match.error!, code: match.code! } }

  // ⭐ 1º import: o arquivo diz quem é a conta, e o sistema PROPÕE guardar
  const aprender = (!input.conta.bankCode && p.bankId) || (!input.conta.accountNumber && p.accountId)
    ? { bankCode: input.conta.bankCode ? null : p.bankId ?? null, accountNumber: input.conta.accountNumber ? null : p.accountId ?? null }
    : null

  // 2 ── DESCARTE DE FUTURO pela âncora do ARQUIVO, nunca pelo relógio (a régua de 13/08)
  // ⚠️ sem âncora no arquivo NÃO se descarta nada: o relógio não decide (a régua de 13/08).
  // Inventar "hoje" como âncora é mentir com cara de fato.
  const ancora = settledThroughDate(p.ledgerBalance?.asOfDate ?? null, p.statementEnd ?? null)
  const { realLines: settled, futureLines: future } = ancora
    ? partitionFutureLines(p.transactions, ancora)
    : { realLines: p.transactions, futureLines: [] }

  // 3 ── O PLANO: o que casa, o que já entrou, o que é novo
  const linhas = settled.map(paraLinha)
  const plano = planoDoExtrato(linhas, input.existentes)

  // 4 ── A CONFERÊNCIA. ⚠️ só o que ENTRA de fato move o saldo: a linha que CASA com um
  // lançamento manual já está no saldo (ela foi lançada), então não soma de novo.
  const declaradoServe = podeConferirPorLedgerbal(perfil)
  const conferencia = conferirSaldo({
    saldoAntes: input.conta.balance,
    entram: plano.novas.map((l) => l.valorComSinal),
    declarado: declaradoServe ? p.ledgerBalance?.amount ?? null : null,
  })

  // 5 ── PAGAMENTO DE FATURA: só nas linhas NOVAS (a que casou já tem dono)
  const pagamentosDeFatura: PreviewDoExtratoPF['pagamentosDeFatura'] = []
  const pagamentosAmbiguos: PreviewDoExtratoPF['pagamentosAmbiguos'] = []
  for (const l of plano.novas) {
    if (l.valorComSinal >= 0) continue
    const r = reconhecerPagamentoDeFatura({ data: l.data, valor: l.valorComSinal, memo: l.memo }, input.faturas)
    if (!r) continue
    if (ehAmbiguo(r)) pagamentosAmbiguos.push({ fitid: l.fitid, faturas: r.ambiguo.map((f) => ({ invoiceId: f.invoiceId, cardNome: f.cardNome })) })
    else pagamentosDeFatura.push({ fitid: l.fitid, ...r })
  }

  const datas = linhas.map((l) => l.data.toISOString().slice(0, 10)).sort()
  return {
    ...vazio,
    aviso: match.warning ?? (perfil ? null : `banco não identificado (${p.bankId ?? 'sem BANKID'}) — dá pra importar, mas não confiro o saldo declarado`),
    aprender,
    periodo: { de: datas[0] ?? null, ate: datas[datas.length - 1] ?? null },
    novas: plano.novas, jaImportadas: plano.jaImportadas, casadas: plano.casadas, ambiguas: plano.ambiguas,
    agendadas: future.map((t) => ({
      linha: paraLinha(t),
      porQue: `o banco listou mas ainda não debitou (data depois de ${ancora?.toISOString().slice(0, 10) ?? 'o fim do extrato'})`,
    })),
    conferencia,
    pagamentosDeFatura, pagamentosAmbiguos,
  }
}
