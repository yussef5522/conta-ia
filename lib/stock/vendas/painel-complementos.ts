// ⭐⭐ O PAINEL DA PRATELEIRA — cards e seções (02/09/2026).
//
// ⚠️ MORA NUMA LIB PURA, não dentro do componente: a lição do prefill do cardápio —
// *regra que mora num `useState` é regra que ninguém prova* (o projeto roda em
// `environment: node`, sem jsdom). A tela só ecoa o que sai daqui.

import type { LinhaPrateleira } from './complemento-map'

export interface CardsPrateleira {
  pendentes: number
  comFicha: number
  ignorados: number
  /**
   * ⭐⭐ O NÚMERO QUE O DONO PEDIU: **quanto da venda já baixa estoque**.
   *
   * É por OCORRÊNCIA, nunca por nome — e a diferença é enorme: CALABRESA sozinha são 115 das
   * 651 ocorrências de 29/08 (18%), enquanto vale 1 nome de 121 (0,8%). Contar nome faria a
   * barra andar devagar justamente quando o dono mapeia o que mais importa.
   *
   * ⚠️ `null` quando não há ocorrência nenhuma — 0% afirmaria "nada coberto" onde a resposta
   * honesta é "não há o que cobrir" (a mesma regra do "sem contagem" do estoque).
   */
  pctCoberto: number | null
  ocorrenciasCobertas: number
  ocorrenciasTotal: number
}

export function cardsDaPrateleira(linhas: readonly LinhaPrateleira[]): CardsPrateleira {
  const total = linhas.reduce((s, l) => s + l.ocorrencias, 0)
  const cobertas = linhas.filter((l) => l.destino === 'FICHA').reduce((s, l) => s + l.ocorrencias, 0)
  return {
    pendentes: linhas.filter((l) => l.destino === 'SEM_FICHA').length,
    comFicha: linhas.filter((l) => l.destino === 'FICHA').length,
    ignorados: linhas.filter((l) => l.destino === 'IGNORAR').length,
    // ⚠️ IGNORAR **não** conta como coberto: ignorar é decidir que não baixa, não é baixar.
    pctCoberto: total > 0 ? Math.round((cobertas / total) * 1000) / 10 : null,
    ocorrenciasCobertas: cobertas,
    ocorrenciasTotal: total,
  }
}

export type ChaveSecao = 'SABORES' | 'OUTROS' | 'IGNORADOS'

export interface Secao {
  chave: ChaveSecao
  titulo: string
  /** o que a seção é, em uma linha — a tela não deve precisar de legenda à parte */
  explica: string
  linhas: LinhaPrateleira[]
  ocorrencias: number
  pendentes: number
}

/**
 * As três seções, na ordem do trabalho.
 *
 * ⭐ SABORES primeiro porque é o trabalho que faz o estoque baixar; OUTROS depois (borda,
 * adicional, tamanho, combo); IGNORADOS por último e **colapsado** — decisão já tomada não
 * disputa espaço com trabalho pendente.
 *
 * ⚠️ IGNORADO SAI DAS DUAS PRIMEIRAS, sempre: um nome ignorado que continuasse aparecendo
 * entre os pendentes de sabor viraria trabalho que se refaz toda vez que o dono abre a tela.
 */
export function secoesDaPrateleira(linhas: readonly LinhaPrateleira[]): Secao[] {
  const ignorados = linhas.filter((l) => l.destino === 'IGNORAR')
  const ativos = linhas.filter((l) => l.destino !== 'IGNORAR')
  const monta = (chave: ChaveSecao, titulo: string, explica: string, ls: LinhaPrateleira[]): Secao => ({
    chave, titulo, explica, linhas: ls,
    ocorrencias: ls.reduce((s, l) => s + l.ocorrencias, 0),
    pendentes: ls.filter((l) => l.destino === 'SEM_FICHA').length,
  })
  return [
    monta('SABORES', 'Sabores de pizza (do cardápio)', 'cada ocorrência baixa a ficha do sabor', ativos.filter((l) => l.grupo === 'SABOR')),
    monta('OUTROS', 'Outros complementos', 'borda, adicional, tamanho, combo de bebida', ativos.filter((l) => l.grupo !== 'SABOR')),
    monta('IGNORADOS', 'Ignorados', 'não baixam estoque — decisão reversível', ignorados),
  ]
}
