// ⭐⭐⭐ O QUE A TELA DE IMPORT PODE AFIRMAR SOBRE O SALDO (04/09/2026).
//
// ⛔ O QUE ESTAVA ERRADO: a tela comparava tudo contra o `<LEDGERBAL>` do OFX e, quando não
// fechava, cuspia *"não identifiquei a causa desta diferença de R$ 2.476,53"* + um aviso
// fóssil de "descolamento em 11–13/08". **Os dois já tinham sido mortos em 01/09**, com
// prova: o LEDGERBAL do Banrisul é o saldo **DISPONÍVEL** — ele desconta o
// `(+) BLOQUEADO + 24 HS` — e a conferência dia-a-dia contra o PDF fechou **22 de 22 dias**.
//
// ⚠️ A FICHA DO BANCO JÁ DIZIA ISSO (`ledgerBalReliable: false`, escrito em 29/08) e o
// import **nunca leu**. Perfil que existe e não é consultado é documentação, não regra.
//
// ⭐⭐ A REGRA: **comparar contra um número que a gente já provou que mente é fabricar
// susto.** Onde o LEDGERBAL não é confiável, a tela: (a) não mostra caixa vermelha de saldo,
// (b) não roda o diagnóstico que se apoia nele, (c) diz o que falta pra poder conferir —
// o PDF. Com o PDF, a régua é o **SALDO NA DATA dia a dia**, e o resultado é
// *"22/22 fecham"* ou *"o dia X não fecha por R$ Y, eis as linhas"*. Nunca "não identifiquei".

import type { BankProfile } from '@/lib/bank-profiles/types'

export type ModoDeConferencia = 'LEDGERBAL' | 'PDF_DIARIO' | 'SEM_CONFERENCIA'

export interface DecisaoDoSelo {
  modo: ModoDeConferencia
  /** a tela pode mostrar a caixa de "saldo não bate"? */
  mostraGateLedgerBal: boolean
  /** roda o diagnóstico `ondeDescolou` (que se apoia em LEDGERBAL consecutivos)? */
  rodaDiagnosticoLedgerBal: boolean
  /** a frase honesta, quando não dá pra conferir */
  aviso: string | null
  /** a tela deve PEDIR o PDF junto do OFX? */
  pedePdf: boolean
}

/**
 * PURA. Decide como este import pode ser conferido.
 *
 * @param ledgerBalReliable ficha do banco (`null` = banco desconhecido → conservador)
 * @param temPdf o dono anexou o PDF do mesmo período?
 */
export function decidirSelo(
  perfil: Pick<BankProfile, 'id' | 'ledgerBalReliable'> | null,
  temPdf: boolean,
): DecisaoDoSelo {
  // ⭐ com o PDF na mão, a régua é sempre a melhor que existe — o saldo contábil por DIA
  if (temPdf) {
    return { modo: 'PDF_DIARIO', mostraGateLedgerBal: false, rodaDiagnosticoLedgerBal: false, aviso: null, pedePdf: false }
  }

  // ⛔ banco cujo LEDGERBAL mente: sem PDF, não há o que conferir — e dizer isso é melhor
  // que inventar uma divergência.
  if (perfil && perfil.ledgerBalReliable === false) {
    return {
      modo: 'SEM_CONFERENCIA',
      mostraGateLedgerBal: false,
      rodaDiagnosticoLedgerBal: false,
      aviso: 'Sem o PDF do extrato não dá pra conferir o saldo: o OFX do Banrisul traz o saldo '
        + 'DISPONÍVEL, que já desconta o bloqueio de 24h. As linhas entram normalmente — o que '
        + 'falta é o selo de conferência. Anexe o PDF do mesmo período pra conferir dia a dia.',
      pedePdf: true,
    }
  }

  // ⚠️ banco desconhecido: também não afirma nada, mas por falta de ficha, não por mania
  // conhecida. Avisa e segue (a mesma disciplina do `bankProfileWarning`).
  if (!perfil) {
    return {
      modo: 'SEM_CONFERENCIA', mostraGateLedgerBal: false, rodaDiagnosticoLedgerBal: false,
      aviso: 'Banco não reconhecido: não sei se o saldo declarado neste OFX é confiável, então '
        + 'não vou afirmar que bate nem que não bate. As linhas entram normalmente.',
      pedePdf: false,
    }
  }

  // ⭐ o caminho de sempre, pros bancos cujo LEDGERBAL é confiável (Sicredi, Stone…)
  return { modo: 'LEDGERBAL', mostraGateLedgerBal: true, rodaDiagnosticoLedgerBal: true, aviso: null, pedePdf: false }
}

export interface SeloDiario {
  /** quantos dias o PDF declarou e quantos fecham */
  diasConferidos: number
  diasQueFecham: number
  todosFecham: boolean
  /** o 1º dia que não fecha — a pergunta que leva a uma ação */
  primeiroQueNaoFecha: { data: string; diferenca: number; lancamentos: { data: string; valor: number; descricao: string }[] } | null
  /** ⭐ o bloqueio vira INFORMAÇÃO, não diferença misteriosa */
  bloqueado: number | null
  saldoDisponivel: number | null
  saldoContabil: number | null
  frase: string
}

/**
 * A frase do selo — o que o dono lê no lugar de "não identifiquei a causa".
 *
 * ⚠️ O BLOQUEIO APARECE COMO INFORMAÇÃO. Ele é a diferença entre o contábil e o disponível,
 * e sempre foi: mostrá-lo ao lado dos dois números transforma o que era um susto de
 * R$ 2.476,53 em uma linha que se lê e se entende.
 */
export function fraseDoSelo(s: Omit<SeloDiario, 'frase'>): string {
  const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  if (s.todosFecham) {
    const extra = s.bloqueado != null && s.bloqueado > 0 && s.saldoDisponivel != null && s.saldoContabil != null
      ? ` · contábil ${brl(s.saldoContabil)} · disponível ${brl(s.saldoDisponivel)} (bloqueio ${brl(s.bloqueado)})`
      : ''
    return `${s.diasQueFecham}/${s.diasConferidos} dias fecham com o extrato${extra}`
  }
  const d = s.primeiroQueNaoFecha
  if (!d) return `${s.diasQueFecham}/${s.diasConferidos} dias fecham`
  const sinal = d.diferenca > 0 ? 'a mais' : 'a menos'
  return `O dia ${d.data.split('-').reverse().join('/')} não fecha: temos ${brl(Math.abs(d.diferenca))} ${sinal} que o extrato. `
    + `${d.lancamentos.length} lançamento(s) nosso(s) nesse dia — confira lado a lado.`
}
