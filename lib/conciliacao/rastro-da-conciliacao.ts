// ⭐⭐⭐ O RASTRO DA CONCILIAÇÃO — o texto que fica na conta (25/09/2026).
//
// **Por que isto virou um arquivo:** o rastro nasceu em 07/09 (o Cancian) dentro do
// `reconcileTransactions`, cresceu em 12/09 (o ramo CLASSIC que não escrevia nada), ganhou o
// MOTIVO em 24/09 e o ATRASO hoje. ⛔ Montado lá dentro, ele **só era testável com banco** —
// e um teste que não alcança a regra vira `toContain` do nome da função, que é menção e não
// uso (a doença que esta casa já registrou sete vezes).
//
// ⭐ **É o contador que lê isto em três meses.** Meia história — *"R$ 35,12 de juros"* sem
// dizer que a conta foi paga com 6 dias de atraso — é justamente o que o faz voltar a
// perguntar.

import { textoDoMotivo, type MotivoDaDiferenca } from './regua-da-diferenca'
import { rastroDaDistancia, type SentidoDaDistancia } from './regua-da-data'

export interface PedacosDoRastro {
  /** a data da linha do extrato (ISO curto) */
  dataDaLinha: string
  /** o valor da linha do extrato */
  valorDaLinha: number
  /** a diferença que o dono confirmou, se houve */
  diferenca?: { valor: number; motivo?: MotivoDaDiferenca | null; livre?: string | null } | null
  /** os dias de atraso/adiantamento que o dono confirmou, se houve */
  distancia?: { dias: number; sentido: SentidoDaDistancia } | null
}

/**
 * ⭐⭐ UM rastro com N pedaços — **nunca dois rastros brigando pelo mesmo campo**.
 *
 * ⚠️ O caso COMUM é o combinado (*atrasou E pagou juros*), e ele vem num gesto só. Montar
 * um texto por confirmação faria o segundo sobrescrever o primeiro — a conta guardaria
 * metade do que aconteceu, sem nada avisando.
 *
 * Devolve `null` quando não há nada a registrar: conciliação limpa não precisa de nota.
 */
export function montarRastro(p: PedacosDoRastro): string | null {
  const pedacos: string[] = []

  if (p.diferenca && Math.abs(p.diferenca.valor) >= 0.01) {
    pedacos.push(
      `diferença de R$ ${p.diferenca.valor.toFixed(2)}`
      + ` = ${textoDoMotivo(p.diferenca.motivo, p.diferenca.livre)}, confirmada por quem conciliou`,
    )
  }

  if (p.distancia) {
    const t = rastroDaDistancia(p.distancia.dias, p.distancia.sentido)
    if (t) pedacos.push(t)
  }

  if (pedacos.length === 0) return null
  return `pagamento conciliado com a linha do extrato de ${p.dataDaLinha}`
    + ` (R$ ${p.valorDaLinha.toFixed(2)}) · ${pedacos.join(' · ')}`
}
