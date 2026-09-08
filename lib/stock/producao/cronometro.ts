// ⛔⛔⛔ O CRONÔMETRO PARADO NO TABLET (08/09/2026) — caso real do dono.
//
// *"Funcionário clica INICIAR e o relógio fica no ZERO — não anda."*
//
// ⭐ MEDIDO EM PROD ANTES DE MEXER: o `iniciadoEm` **grava certinho** (4 de 12 etapas
// recentes têm o carimbo, e as durações fecham). O tempo real nunca esteve errado — era só
// a PINTURA, e a pintura confiava na fonte errada.
//
// ⛔⛔ A CAUSA: o cálculo era `Math.max(0, Date.now() − iniciadoEm)`. Num tablet com a hora
// ATRASADA em relação ao servidor, a conta dá NEGATIVO e o `max` **para o relógio em 00:00**
// — pelo tanto de tempo que o aparelho estiver atrasado. E o `max` era justamente o que
// ESCONDIA o problema: em vez de acusar, mentia zero.
//
// ⚠️ A casa já sabia disso: *"o cronômetro é da TELA, o instante é do servidor (…) relógio
// de aparelho pode estar torto"* está escrito desde 06/09, na tela do HOJE. Faltava aplicar
// no tablet — que é justamente onde o aparelho é compartilhado e ninguém acerta a hora.

export interface RelogioDaTarefa {
  segundos: number
  /** ⛔ o aparelho está adiantado: a tela AVISA em vez de fingir zero */
  relogioTorto: boolean
  /** mm:ss, pronto pra pintar */
  texto: string
}

/** tolerância: 2s de folga cobre latência de rede sem esconder desvio de verdade */
const FOLGA_SEGUNDOS = 2

/**
 * Quanto tempo a tarefa está rodando, na régua do SERVIDOR.
 *
 * @param iniciadoEm  ISO do carimbo do servidor (o toque no INICIAR)
 * @param agora       `Date.now() + desvio`, onde o desvio foi MEDIDO contra o servidor
 */
export function relogioDaTarefa(iniciadoEm: string | null, agora: number): RelogioDaTarefa {
  if (!iniciadoEm) return { segundos: 0, relogioTorto: false, texto: '00:00' }
  const bruto = Math.floor((agora - new Date(iniciadoEm).getTime()) / 1000)
  const segundos = Math.max(0, bruto)
  const mm = String(Math.floor(segundos / 60)).padStart(2, '0')
  const ss = String(segundos % 60).padStart(2, '0')
  return { segundos, relogioTorto: bruto < -FOLGA_SEGUNDOS, texto: `${mm}:${ss}` }
}

/**
 * O desvio entre o relógio do aparelho e o do servidor, em ms.
 *
 * ⚠️ MEDIDO a cada resposta, nunca suposto — e é isto que faz o cronômetro andar mesmo num
 * tablet com a hora errada. `agora` é injetável pro teste não depender do relógio real.
 */
export function desvioDoAparelho(agoraServidorIso: string, agoraLocal: number = Date.now()): number {
  return new Date(agoraServidorIso).getTime() - agoraLocal
}
