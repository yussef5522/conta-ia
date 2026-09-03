// ⭐⭐ O PAINEL DA PRATELEIRA — cards e seções (02/09/2026).
//
// ⚠️ MORA NUMA LIB PURA, não dentro do componente: a lição do prefill do cardápio —
// *regra que mora num `useState` é regra que ninguém prova* (o projeto roda em
// `environment: node`, sem jsdom). A tela só ecoa o que sai daqui.

import type { LinhaPrateleira } from './complemento-map'
import type { GrupoComplemento } from './grupo-complemento'

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
    // ⭐ PENDENTE conta NOME (cada um é um trabalho a fazer) e COM FICHA conta **FICHA**
    // (03/09): dois nomes na mesma ficha são UM sabor resolvido, não dois. Contar nome nos
    // dois lados faria o card discordar da lista agrupada logo abaixo dele.
    pendentes: linhas.filter((l) => l.destino === 'SEM_FICHA').length,
    comFicha: new Set(linhas.filter((l) => l.destino === 'FICHA' && l.fichaId).map((l) => l.fichaId)).size,
    ignorados: linhas.filter((l) => l.destino === 'IGNORAR').length,
    // ⚠️ IGNORAR **não** conta como coberto: ignorar é decidir que não baixa, não é baixar.
    pctCoberto: total > 0 ? Math.round((cobertas / total) * 1000) / 10 : null,
    ocorrenciasCobertas: cobertas,
    ocorrenciasTotal: total,
  }
}

export type ChaveSecao = 'SABORES' | 'OUTROS' | 'IGNORADOS'

export interface Secao<T = LinhaPrateleira> {
  chave: ChaveSecao
  titulo: string
  /** o que a seção é, em uma linha — a tela não deve precisar de legenda à parte */
  explica: string
  linhas: T[]
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
export function secoesDaPrateleira<T extends Pick<LinhaPrateleira, 'destino' | 'grupo' | 'ocorrencias'>>(
  linhas: readonly T[],
): Secao<T>[] {
  const ignorados = linhas.filter((l) => l.destino === 'IGNORAR')
  const ativos = linhas.filter((l) => l.destino !== 'IGNORAR')
  const monta = (chave: ChaveSecao, titulo: string, explica: string, ls: T[]): Secao<T> => ({
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

/**
 * ⛔⛔ A CARGA DA PRATELEIRA É DO ESTADO, NÃO DO GESTO (03/09/2026).
 *
 * REGRESSÃO REAL, minha, no mesmo dia: eu fiz a aba abrir por `?aba=complementos` na URL,
 * mas o `carregarPrateleira()` só era chamado no **onClick da aba**. Entrando pela URL — que
 * é justamente pra onde o "voltar" do editor passou a mandar — a aba abria e **o fetch nunca
 * acontecia**: `prateleira` ficava `null` e o componente girava o spinner pra sempre.
 * ⚠️ Sem erro nenhum: nada quebrou, nada estourou no log. Foi requisição que **não começou**,
 * que é pior de achar que requisição que falha.
 *
 * ⭐ A cura é amarrar a carga ao ESTADO ("a aba está aberta e o dado não está aqui"), não ao
 * GESTO ("alguém clicou"). É a família do "N caminhos, 1 esquecido": toda porta nova pra
 * essa aba — URL, clique, link de fora — passa a carregar de graça.
 */
export function precisaCarregarPrateleira(aba: string, prateleira: unknown | null): boolean {
  return aba === 'complementos' && prateleira === null
}

export interface ApelidoDoPdv {
  nomeSuitable: string
  ocorrencias: number
}

export interface LinhaAgrupada extends Omit<LinhaPrateleira, 'nomeSuitable'> {
  /** o que a tela mostra como título: o nome da FICHA quando há uma; senão o nome cru */
  titulo: string
  /** ⚠️ o nome CRU representativo — as ações (ignorar/desfazer) são por nome, sempre */
  nomeSuitable: string
  /** os nomes crus que o PDV manda pra este mesmo destino, com o que cada um trouxe */
  apelidos: ApelidoDoPdv[]
}

/**
 * ⭐⭐ AGRUPA NA APRESENTAÇÃO, NUNCA FUNDE NO DADO (03/09/2026).
 *
 * O PDV manda o mesmo sabor com grafias diferentes — MEDIDO no relatório real: **31 grupos**,
 * sendo `CALABRESA` (1.220) + `Calabresa` (1) + `calabresa` (1), e
 * `FRANGO COM BACON` (14) + `frango com bacon` (1). Pro dono é **um sabor só**.
 *
 * ⛔⛔ O NOME CRU CONTINUA GRAVADO COMO VEIO. É ele que casa com o relatório de amanhã: fundir
 * no dado faria a importação do próximo dia não reconhecer a grafia que sumiu, e aí a venda
 * deixa de baixar em silêncio. A linha única é da TELA; embaixo dela ficam os apelidos.
 *
 * ⭐ O CRITÉRIO É O DESTINO, não a semelhança: nomes apontados pra MESMA ficha viram uma
 * linha. ⛔ **Pendente NÃO se agrupa** — antes de o dono mapear, não há como saber que dois
 * nomes são o mesmo sabor, e adivinhar por parecido é a classe do "memo diz Transferência":
 * sugere, nunca funde.
 *
 * ⚠️ E `IGNORAR` também fica linha por linha: ignorar é decisão por NOME (um `GRANDE` não
 * tem nada a ver com um `PEQUENO`), e juntá-los esconderia o que exatamente foi ignorado.
 */
export function agruparPorDestino(linhas: readonly LinhaPrateleira[]): LinhaAgrupada[] {
  const porFicha = new Map<string, LinhaPrateleira[]>()
  const soltas: LinhaPrateleira[] = []
  for (const l of linhas) {
    if (l.destino === 'FICHA' && l.fichaId) porFicha.set(l.fichaId, [...(porFicha.get(l.fichaId) ?? []), l])
    else soltas.push(l)
  }

  const agrupadas: LinhaAgrupada[] = []
  for (const [, ls] of porFicha) {
    // o nome cru de MAIOR volume representa o grupo nas ações — é o que o PDV usa de fato
    const ordenados = [...ls].sort((a, b) => b.ocorrencias - a.ocorrencias)
    const base = ordenados[0]
    agrupadas.push({
      ...base,
      titulo: base.nomeFicha ?? base.nomeSuitable,
      ocorrencias: ls.reduce((s, l) => s + l.ocorrencias, 0),
      apelidos: ordenados.map((l) => ({ nomeSuitable: l.nomeSuitable, ocorrencias: l.ocorrencias })),
      // ⚠️ se um apelido é sabor do cardápio, o grupo é de SABOR: o agrupamento não pode
      // esconder da seção de sabores uma ficha que atende sabor.
      grupo: (ls.some((l) => l.grupo === 'SABOR') ? 'SABOR' : 'OUTRO') as GrupoComplemento,
      tambemProduto: ls.some((l) => l.tambemProduto),
      destinoComoProduto: ls.find((l) => l.destinoComoProduto)?.destinoComoProduto ?? null,
    })
  }
  for (const l of soltas) agrupadas.push({ ...l, titulo: l.nomeSuitable, apelidos: [{ nomeSuitable: l.nomeSuitable, ocorrencias: l.ocorrencias }] })

  return agrupadas.sort((a, b) => b.ocorrencias - a.ocorrencias || a.titulo.localeCompare(b.titulo, 'pt-BR'))
}
