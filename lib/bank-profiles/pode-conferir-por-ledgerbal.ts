// ⛔⛔⛔ A PERGUNTA "O SALDO DECLARADO SERVE DE RÉGUA?" TEM UM DONO SÓ (05/09/2026).
//
// **SEGUNDA OCORRÊNCIA DA MESMA CLASSE NO MESMO PERFIL.** Em 01/09 o `ledgerBalReliable:
// false` do Banrisul foi ligado no selo e no `ledgerBalMatched`; em 04/09, no preview. E o
// **gate do CONFIRMAR ficou pra trás** — o dono importou, o dinheiro entrou, e a tela cuspiu
// *"Saldo não fechou com o banco — Calculado −R$ 5.871,14 vs LEDGERBAL −R$ 8.347,67. Revise
// a classificação."* Os R$ 2.476,53 de diferença são **o bloqueio de 24h**, a mania que este
// projeto documenta desde 15/08 — não classificação errada.
//
// ⚠️ E O FÓSSIL ESTAVA A 35 LINHAS DO CONSERTO: no MESMO arquivo, o `ledgerBalMatched`
// consulta a ficha do banco desde 01/09 e o `ledgerMismatch`, logo acima, não consultava.
// Corrigir o vizinho e não o vizinho do lado é a assinatura da classe "N caminhos".
//
// ⭐ POR ISSO A DECISÃO VIRA **UMA FUNÇÃO**, não mais um `?? true` copiado: eram **6
// lugares** lendo `ledgerBalReliable` na mão (orquestrador ×2, resolve-import-statuses,
// selo, classify-for-import, judge). Quem esquecer de chamar aqui não tem onde esconder —
// há um guard estrutural que reprova leitura direta do campo fora deste arquivo.

import type { BankProfile } from './types'

/** só o que interessa da ficha — aceita o perfil inteiro ou um pedaço */
export type FichaParaLedgerbal = Pick<BankProfile, 'ledgerBalReliable'> | null | undefined

/**
 * O `<LEDGERBAL>` deste banco pode ser usado como RÉGUA de conferência? PURA.
 *
 * ⛔ **`false` no Banrisul**: o número que ele declara é o saldo **DISPONÍVEL**, já
 * descontando o "(+) BLOQUEADO + 24 HS", e o arquivo não manda o bloqueio separado — não há
 * como reconciliar. A régua de lá é o **SALDO NA DATA do PDF**, dia a dia.
 *
 * ⚠️ **BANCO DESCONHECIDO → `true`, de propósito.** Aqui a pergunta é "este banco tem mania
 * conhecida que invalida o número?"; sem ficha, a resposta honesta é "não sei de nenhuma", e
 * tirar o dente do gate em todo banco novo seria pior que o problema. Quem trata a ressalva
 * do banco desconhecido é a TELA (`decidirSelo` devolve `SEM_CONFERENCIA` e diz que não vai
 * afirmar nada) — avisar é da tela; **travar gravação, não.**
 */
export function podeConferirPorLedgerbal(ficha: FichaParaLedgerbal): boolean {
  return ficha?.ledgerBalReliable !== false
}

/**
 * A frase pro import que gravou sem poder conferir o saldo.
 *
 * ⛔⛔ REGRA DO DONO (05/09): *"recusar a gravação por causa de um número que a gente provou
 * que mente é segurar meu dinheiro fora do sistema por fé num número errado."* O import
 * grava; o que falta é o SELO, e a tela diz isso com todas as letras — sem vermelho, porque
 * não há nada a corrigir.
 */
export function avisoSemReguaDeSaldo(nomeDoBanco?: string | null): string {
  return `As linhas entraram normalmente. O que falta é o selo de conferência do saldo: `
    + `o saldo declarado no OFX${nomeDoBanco ? ` do ${nomeDoBanco}` : ''} é o DISPONÍVEL `
    + `(já desconta o bloqueio de 24h), então comparar com ele acusaria uma diferença que não existe. `
    + `Anexe o PDF do extrato pra conferir dia a dia.`
}

export interface FechamentoDeSaldo {
  /** diferença a REPORTAR como problema (null = não há o que reportar) */
  mismatch: { saldoCalculado: number; ledgerBal: number; diferenca: number } | null
  /** selo do import: true/false quando dá pra afirmar, `null` quando não dá */
  ledgerBalMatched: boolean | null
  /** gravou sem poder conferir o saldo por aqui — NOTÍCIA, não erro */
  avisoSemSelo: string | null
}

/** tolerância do fechamento: 2 centavos (a de sempre) */
export const TOLERANCIA_FECHAMENTO = 0.02

/**
 * ⭐⭐ AS TRÊS SAÍDAS DO FECHAMENTO DE SALDO SAEM DE UM CÁLCULO SÓ. PURA.
 *
 * ⛔ Era exatamente isto que faltava: `ledgerMismatch` e `ledgerBalMatched` eram calculados
 * em **dois pontos do mesmo arquivo, 35 linhas de distância** — um consultava a ficha do
 * banco (desde 01/09) e o outro não. Duas respostas pra mesma pergunta é como o fóssil
 * sobreviveu a três correções.
 *
 * ⚠️ `ledgerBalMatched: null` NÃO é "não bateu" — é **"não dá pra dizer por aqui"**. Quem
 * diz, no Banrisul, é a conferência dia a dia contra o PDF.
 */
export function avaliarFechamentoDeSaldo(input: {
  ficha: FichaParaLedgerbal
  nomeDoBanco?: string | null
  saldoCalculado: number
  ledgerBalance: number | null
}): FechamentoDeSaldo {
  const ehRegua = podeConferirPorLedgerbal(input.ficha)

  // sem saldo declarado no arquivo não há o que conferir — e não se avisa o que não se mediu
  if (input.ledgerBalance == null) {
    return { mismatch: null, ledgerBalMatched: null, avisoSemSelo: null }
  }

  // ⛔ o número existe mas MENTE (Banrisul): grava, não compara, e DIZ que o selo falta.
  // "Recusar a gravação por causa de um número que a gente provou que mente é segurar o
  // dinheiro do dono fora do sistema por fé num número errado." (dono, 05/09)
  if (!ehRegua) {
    return { mismatch: null, ledgerBalMatched: null, avisoSemSelo: avisoSemReguaDeSaldo(input.nomeDoBanco) }
  }

  const diferenca = Math.round((input.saldoCalculado - input.ledgerBalance) * 100) / 100
  const fecha = Math.abs(diferenca) <= TOLERANCIA_FECHAMENTO
  return {
    mismatch: fecha ? null : { saldoCalculado: input.saldoCalculado, ledgerBal: input.ledgerBalance, diferenca },
    ledgerBalMatched: fecha,
    avisoSemSelo: null,
  }
}
