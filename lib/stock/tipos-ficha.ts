// ⭐⭐ OS TRÊS TIPOS DE FICHA — o vocabulário num lugar só (03/09/2026).
//
// ⛔ O BUG QUE CRIOU ESTE ARQUIVO: `tipoProduto` estava respondendo DUAS perguntas
// diferentes — *"como isto baixa na venda?"* e *"isto aparece na cozinha?"*. A ficha de
// SABOR (CALABRESA) nasceu `INTERMEDIARIO` pela mecânica da baixa e foi parar em
// **Produção › Receitas**, no meio das 20 receitas reais. Com ~50 sabores a caminho,
// seriam 50 intrusos na tela de quem cozinha.
//
// ⭐ AS TRÊS COISAS, e elas são mesmo diferentes:
//   INTERMEDIARIO  a cozinha FAZ em lote, rendimento é MEDIDO   → porção de calabresa 120g
//   PRODUTO_FINAL  o cliente COMPRA, monta no pedido            → XIS COMPLETO
//   SABOR          escolha DENTRO de um produto, monta no pedido → CALABRESA (a pizza)
//
// ⚠️ O SABOR NÃO É NENHUM DOS DOIS: não se produz em lote (não tem rendimento a medir) e
// não é item de cardápio (não tem preço próprio — o preço é o da pizza).
//
// ⭐⭐ E A SEPARAÇÃO SAI DE GRAÇA, sem `if` novo em tela nenhuma: cada régua já é uma
// ALLOWLIST (`=== INTERMEDIARIO` na produção, `=== PRODUTO_FINAL` no cardápio e no mapa de
// produtos), então um tipo novo fica de fora **por construção**. Tipo que se acrescenta sem
// precisar caçar filtro é o sinal de que o vocabulário estava faltando, não sobrando.

export const TIPO_INTERMEDIARIO = 'INTERMEDIARIO' as const
export const TIPO_PRODUTO_FINAL = 'PRODUTO_FINAL' as const
export const TIPO_SABOR = 'SABOR' as const

export type TipoFicha = typeof TIPO_INTERMEDIARIO | typeof TIPO_PRODUTO_FINAL | typeof TIPO_SABOR

export const TIPOS_FICHA: readonly TipoFicha[] = [TIPO_INTERMEDIARIO, TIPO_PRODUTO_FINAL, TIPO_SABOR]

export function ehTipoDeFicha(t: string): t is TipoFicha {
  return (TIPOS_FICHA as readonly string[]).includes(t)
}

/**
 * ⭐ "MONTA NA VENDA" — a régua que decide se a ficha EXPLODE nos componentes ou se ela
 * mesma é o pack que baixa.
 *
 * ⚠️ Vale pros DOIS que se montam no pedido (produto final e sabor). Um SABOR usado como
 * componente de outra ficha, sem isto, cairia em "baixa o pack" e consumiria o item-invólucro
 * — que **ninguém produz** — gerando saldo negativo eterno num item fantasma.
 * O intermediário é o contrário: ele É o pack pronto, e baixar o pack é o certo.
 */
export function montaNaVenda(tipoProduto: string): boolean {
  return tipoProduto === TIPO_PRODUTO_FINAL || tipoProduto === TIPO_SABOR
}

/** Rótulo pt-BR pra tela. ⚠️ era binário ("Produto final : Intermediário") e mentia no 3º. */
export function rotuloTipoFicha(tipoProduto: string): string {
  if (tipoProduto === TIPO_PRODUTO_FINAL) return 'Produto final'
  if (tipoProduto === TIPO_SABOR) return 'Sabor'
  if (tipoProduto === TIPO_INTERMEDIARIO) return 'Intermediário'
  return tipoProduto
}

/**
 * ⭐ O QUE SE CONTA FISICAMENTE na câmara/prateleira.
 *
 * ⚠️ PERGUNTA DIFERENTE de "é produzível" — por isso tem régua própria, mas mora no MESMO
 * arquivo de vocabulário (uma pergunta, uma função; nada de `filter` solto por tela).
 *
 * ⛔ O invólucro de SABOR não é coisa física: ninguém pesa "CALABRESA" na câmara — o que
 * existe lá é a *porção de calabresa*. Sem esta régua, a contagem inicial nasceria com ~50
 * linhas impossíveis de contar, e linha que não dá pra contar vira linha que se ignora —
 * o começo do "0/N que ninguém fecha".
 *
 * ⚠️ DÍVIDA REGISTRADA (pré-existente, não mexida aqui): item de `PRODUTO_FINAL`
 * (XIS COMPLETO, PIZZA PEQUENA 25CM) **também** aparece na contagem hoje e também não se
 * conta — são 2 linhas, e mexer nisso é decisão do dono, não efeito colateral deste fix.
 */
export function seContaFisicamente(categoria: string): boolean {
  return categoria !== TIPO_SABOR
}

/**
 * ⭐ Quem pode ATENDER um nome do relatório de PRODUTOS.
 *
 * ⚠️ Espelha o guard de `upsertVendaMap` (que é quem RECUSA na gravação) pra a tela não
 * oferecer o que o servidor vai negar — oferecer e depois recusar é como se ensina o
 * usuário a desconfiar do sistema. A recusa continua sendo do servidor; isto é só a lista.
 */
export function podeAtenderProdutoDoPdv(tipoProduto: string): boolean {
  return tipoProduto === TIPO_PRODUTO_FINAL
}
