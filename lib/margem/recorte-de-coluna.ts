/**
 * ⭐⭐⭐ A LEI DAS COLUNAS (13/10/2026) — o teto da lista e as colunas terminando juntas.
 *
 * **Escrita no CSS da referência v4, verbatim:** *"lista comprida NUNCA mora inteira numa
 * coluna lateral — ela ganha teto: TOP 10 + «ver todos» que expande ali mesmo. No estado
 * padrão (tudo recolhido), as duas colunas de cada dupla terminam JUNTAS: diferença de altura
 * de no máximo ~um cartão pequeno (~140px). Coluna fantasma — vazio comprido de um lado
 * enquanto o outro rola — é tela REPROVADA."*
 *
 * ⛔⛔ **UM TETO SÓ, PROS DOIS CARTÕES DA DUPLA — e isso não é economia, é a única forma de a
 * lei valer.** A v4 se contradiz no desenho: ela DECLARA `TOP 10` e DESENHA 6 linhas em
 * "quem carregou" contra as da liga. A 38px por linha (o `padding:9px` + `font-size:13.5px`
 * com `line-height:1.45` do CSS dela), 4 linhas de diferença são **152px** — fora da
 * tolerância de 140 que ela própria escreveu. Com dois tetos separados, alguém ajusta um e a
 * coluna fantasma volta **sem nada ficar vermelho**. Com um dono único, ela é impossível.
 *
 * ⚠️ E o teto é de EXIBIÇÃO, nunca de leitura: a lista inteira continua chegando na tela
 * (expandir não refaz consulta). É o oposto do `take` que escondeu o fermento da busca
 * (16/09) e a ordem do ano 202 da lista (19/09) — ali o teto cortava o DADO.
 *
 * ⛔ Função PURA: *regra que mora num `useState` é regra que ninguém prova* (a lição do
 * prefill do cardápio, que quebrou 2× antes de virar função).
 */

/**
 * ⭐ O TETO — o número que o dono escreveu (`TOP 10`), num lugar só.
 *
 * ⛔ Digitado na tela ele seria a segunda régua no dia em que ele mudar — a cicatriz do
 * `TETO = 25` da conciliação e do `30` da janela do "a vencer".
 */
export const TOPO_DA_COLUNA = 10

/**
 * ⭐ A TOLERÂNCIA DA LEI, em LINHAS — derivada dos px da referência, não escolhida.
 *
 * `~140px ÷ ~38px por linha = 3,6` → **3 linhas**. Com 4 já são 152px, fora do que ela
 * escreveu. Converter pra linha (e não medir px) é o que torna a lei testável sem navegador:
 * as duas colunas usam o MESMO `padding:9px 18px` e o MESMO `font-size:13.5px` no CSS da
 * referência, então linha por linha elas têm a mesma altura — contar linha É medir altura.
 */
export const DIFERENCA_MAXIMA_EM_LINHAS = 3

export interface RecorteDaColuna<T> {
  visiveis: T[]
  /** quantas ficaram atrás do "ver todos" — `0` quando a lista cabe no teto */
  escondidas: number
  /** ⭐ o rótulo do botão, nos dois sentidos, como a referência escreve */
  rotuloDoBotao: string | null
  expandido: boolean
}

/**
 * ⭐ O RECORTE — top 10 recolhido, a lista inteira expandida, no MESMO lugar.
 *
 * ⚠️ **Estado inicial SEMPRE recolhido** (a referência: *"Estado inicial: SEMPRE recolhido"*):
 * nascer aberto é a lista de 50 rolando sozinha na coluna, que é exatamente o que esta lei
 * existe pra matar.
 *
 * ⛔ Lista que CABE no teto não ganha botão: *botão que não faz nada é ruído* — e o dono
 * aprende a não procurar o que às vezes não está lá.
 */
export function recorteDaColuna<T>(
  linhas: readonly T[],
  expandido: boolean,
  teto = TOPO_DA_COLUNA,
): RecorteDaColuna<T> {
  const cabe = linhas.length <= teto
  const visiveis = cabe || expandido ? [...linhas] : linhas.slice(0, teto)
  const escondidas = cabe ? 0 : linhas.length - teto

  return {
    visiveis,
    escondidas,
    rotuloDoBotao: cabe
      ? null
      : expandido
        ? `mostrar só o top ${teto} ▴`
        : `ver todos os ${linhas.length} ▾`,
    expandido: cabe ? true : expandido,
  }
}

/**
 * ⭐⭐ O INVARIANTE DA LEI — *"coluna fantasma = tela reprovada"*, virado teste.
 *
 * Recebe quantas LINHAS cada coluna da dupla desenha no estado recolhido (incluindo as linhas
 * que não são de lista: abas, rodapé, mediana, o próprio "ver todos") e diz se a dupla passa.
 *
 * ⚠️ Ele não mede pixel de propósito — ver `DIFERENCA_MAXIMA_EM_LINHAS`. Medir px exigiria
 * navegador, e aí a lei só seria conferida por olho humano, que é como ela se perde.
 */
export function colunasTerminamJuntas(
  linhasEsquerda: number,
  linhasDireita: number,
): { passa: boolean; diferenca: number; porque: string } {
  const diferenca = Math.abs(linhasEsquerda - linhasDireita)
  const passa = diferenca <= DIFERENCA_MAXIMA_EM_LINHAS
  return {
    passa,
    diferenca,
    porque: passa
      ? `diferença de ${diferenca} linha(s) — dentro de ~um cartão pequeno`
      : `COLUNA FANTASMA: ${diferenca} linhas de diferença (o teto da lei é ${DIFERENCA_MAXIMA_EM_LINHAS}) — ` +
        `uma coluna vazia enquanto a outra rola é tela reprovada`,
  }
}
