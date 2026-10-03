/**
 * ⛔⛔⛔ A PORTA ÚNICA DE "QUERO N" → SEPARAÇÃO. **RECEITA É LEI** (decisão do dono, 03/10/2026).
 *
 * **A ordem dele, ao pé da letra:** *"A separação da ordem é SEMPRE ficha × pedido, SEM
 * rendimento no meio. O rendimento medido (mediana, faixa, tudo) SAI da conta da separação —
 * ele NUNCA multiplica nem divide nada."*
 *
 * ⭐⭐ **E O MOTIVO É DE DONO, NÃO DE ARITMÉTICA:** *"se funcionário rende mal ou rouba, um
 * sistema que adapta a separação pela medição APRENDE o roubo como normal e passa a cobrir
 * ele."* Um laço de realimentação que se calibra pelo desvio **deixa de medir o desvio** —
 * ele vira a nova linha de base, e no mês seguinte ninguém sabe mais qual era o certo.
 *
 * ⚠️ **ISSO REVERTE A DECISÃO DE 01/09**, e a reversão é consciente. Naquele dia a régua
 * passou a ser a MEDIDA porque *"pelo teórico (0,135 × 200 = 27 kg) ele pega pouco e falta"*.
 * O caso do `beef de xis` (03/10) mostrou o preço: a média envenenada por 2 lotes de 27 fez
 * uma ordem de **10** propor material pra **6,7**. A saída que o dono escolheu **não é afinar
 * a estatística — é tirá-la da conta**. Se a perda é real, *ele* declara na ficha
 * (*"acém limpo = 95% do cru"*); o sistema nunca a declara por conta própria.
 *
 * ⛔⛔ **A TRAVA É ESTRUTURAL, NÃO COMBINADA (REGRA 5):** `PedidoDaOrdem` **não tem campo de
 * rendimento medido**, então passar um é impossível — não há o que esquecer de conferir. É o
 * mesmo desenho do `createOfxImportRecord` (que EXIGE o blob no tipo) e do `finalizadoEm` que
 * fica NULL de propósito pra o tempo não entrar na média.
 *
 * ⭐ E o que a medição virou está em `eficiencia-da-ordem.ts`: **espelho** — eficiência por
 * ordem, visível, com o consumo real ao lado, e o juiz **P8** denunciando quando ela cai.
 * *Me DENUNCIA, não me corrige.*
 */

const round4 = (n: number) => Math.round((n + 1e-9) * 10000) / 10000

export interface PedidoDaOrdem {
  /** quantas unidades do produto o dono quer */
  pedido: number
  /**
   * O que a FICHA declara que 1 execução da receita produz (`loteBase`).
   *
   * ⚠️ É o ÚNICO divisor que existe aqui. Quando ele não é um rendimento comparável
   * (`unidadeLoteBase` ≠ unidade em que o produto se conta), a conta sai torta — e quem
   * avisa é o `LOTE_NAO_COMPARAVEL` de `escala-do-pedido.ts` e o M5. **Avisar é o certo;
   * o errado era compensar com a média.**
   */
  loteBase: number
}

/**
 * PURA. Quantas execuções da receita pra entregar o pedido. `pedido ÷ loteBase`, e nada mais.
 *
 * ⚠️ `loteBase` costuma ser 1 (dose por unidade), e aí `escala === pedido` — é por isso que
 * o pin do dono é direto: *10 beef de xis separa 0,910 de acém* (a dose da ficha × 10).
 */
export function escalaDoPedido(p: PedidoDaOrdem): number | null {
  if (!(p.pedido > 0) || !(p.loteBase > 0)) return null
  return round4(p.pedido / p.loteBase)
}

/**
 * PURA. Quanto pegar de UM insumo pra entregar o pedido. `dose × pedido ÷ loteBase`.
 *
 * ⛔ Nenhum fator de rendimento, nenhuma faixa, nenhuma mediana. **É a ficha.**
 */
export function insumoDoPedido(p: PedidoDaOrdem, porLote: number): number | null {
  const escala = escalaDoPedido(p)
  if (escala == null || !(porLote > 0)) return null
  return round4(escala * porLote)
}

/**
 * PURA. O inverso declarado: quantas unidades saem de `escala` execuções, **pela ficha**.
 *
 * ⭐ É a expectativa contra a qual a eficiência é medida — *o que a receita prometia*. A
 * média histórica não entra: ela é o espelho, e espelho não define a meta.
 */
export function saidaEsperadaDaFicha(escala: number, loteBase: number): number | null {
  if (!(escala > 0) || !(loteBase > 0)) return null
  return round4(escala * loteBase)
}
