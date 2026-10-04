/**
 * ⭐ "O LOTE DESTA FICHA É COMPARÁVEL?" — o dono ÚNICO da pergunta (04/10/2026).
 *
 * ⚠️ A pergunta existia em UM lugar (o M5 do juiz) e passou a ter TRÊS leitores: o juiz, a
 * lista de pendentes do assistente de conversão, e o atalho no aviso da ordem. **Três cópias
 * do `unidadeLoteBase !== unidadeControle` divergiriam no primeiro caso de borda** — é a lição
 * do B1 e dos 7 detectores de par. A régua mora aqui; os três chamam.
 *
 * ⛔ **E O ARQUIVO É PURO DE PROPÓSITO** (zero import, zero banco): o juiz do estoque roda
 * contra o banco INTEIRO toda noite e precisa de um `===`, não da cadeia de `conclusao.ts`.
 * Quem responde *"quais fichas ainda faltam converter?"* é `fichas-para-converter.ts`, que é
 * outra pergunta — e que chama esta.
 */

/**
 * PURA. O lote declarado responde *"quantas unidades saem de 1 receita"*?
 *
 * ⛔ Só quando a unidade do lote é a unidade em que o produto se **CONTA**. Senão o `loteBase`
 * é um número de outra grandeza — e é ele que divide o pedido na porta da separação.
 */
export function loteEhComparavel(unidadeLoteBase: string, unidadeControleDoProduto: string): boolean {
  return unidadeLoteBase === unidadeControleDoProduto
}
