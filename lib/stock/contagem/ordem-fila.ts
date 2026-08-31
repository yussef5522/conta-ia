// ⭐⭐ O CAMINHO FÍSICO DO ESTOQUE — a ordem em que se ANDA, não a do banco (31/08/2026).
//
// As líderes (Finale, Stockount, Erply) ordenam a contagem pelo caminho físico — câmara →
// freezer → seco → salão — pra ninguém andar duas vezes. Por categoria, quem conta vai da
// câmara ao salão e volta.
//
// ⚠️⚠️ POR QUE A ESTRUTURA NASCE AGORA, mesmo a fila indo por CATEGORIA (decisão do dono, e
// o argumento é dele): com migration CREATE-only, **"deixa o caminho pra depois" vira
// "nunca"** — a tabela tem que existir antes de alguém precisar dela.
//
// ⚠️ E NINGUÉM PREENCHE 91 CAMPOS À MÃO: a ordem é ARRASTÁVEL na fila e o sistema guarda.
// A primeira contagem estabelece o caminho andando. Item sem posição guardada vai pro FIM,
// nunca pro meio — item novo não pode empurrar o caminho que já existe.

export interface ItemDaFila {
  itemId: string
  nome: string
  categoria: string
}

/** posição guardada por item (vazio = ninguém arrastou nada ainda) */
export type CaminhoGravado = Map<string, number>

/**
 * A ordem em que a fila aparece.
 *
 * ⚠️ REGRA: quem TEM posição guardada vem primeiro, na ordem do caminho; quem não tem vem
 * depois, agrupado por categoria (o comportamento de hoje). Assim o caminho vai nascendo
 * aos poucos, sem precisar de um "modo configurar caminho" que ninguém abriria.
 */
export function ordenarFila(itens: ItemDaFila[], caminho: CaminhoGravado): ItemDaFila[] {
  const comCaminho = itens.filter((i) => caminho.has(i.itemId))
  const sem = itens.filter((i) => !caminho.has(i.itemId))

  comCaminho.sort((a, b) => (caminho.get(a.itemId)! - caminho.get(b.itemId)!) || a.nome.localeCompare(b.nome, 'pt-BR'))
  sem.sort((a, b) => a.categoria.localeCompare(b.categoria, 'pt-BR') || a.nome.localeCompare(b.nome, 'pt-BR'))

  return [...comCaminho, ...sem]
}

/**
 * Move um item de posição e devolve o caminho INTEIRO renumerado.
 *
 * ⚠️ RENUMERA TUDO de propósito: guardar só a linha movida deixaria buracos e empates, e o
 * empate faz a fila trocar de ordem sozinha entre dois carregamentos — o pior defeito
 * possível numa tela que alguém está usando pra andar pelo estoque.
 */
export function moverNaFila(itens: ItemDaFila[], de: number, para: number): CaminhoGravado {
  const lista = [...itens]
  if (de < 0 || de >= lista.length || para < 0 || para >= lista.length || de === para) {
    return new Map(lista.map((i, k) => [i.itemId, k]))
  }
  const [movido] = lista.splice(de, 1)
  lista.splice(para, 0, movido)
  return new Map(lista.map((i, k) => [i.itemId, k]))
}
