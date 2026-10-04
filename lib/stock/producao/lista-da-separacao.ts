/**
 * ⭐⭐ "O QUE VAI SAIR DA CÂMARA" — a lista que a tela mostra ANTES de criar a ordem (04/10/2026).
 *
 * **Pedido do dono (item 2):** *"campo em UN grande e claro ('quero produzir: 80 UN') + a lista
 * do que VAI SEPARAR do estoque (componente a componente, da ficha × pedido) ANTES de
 * confirmar."*
 *
 * ⚠️ **A régua mora aqui, não no JSX** — *regra que vive num componente é regra que ninguém
 * prova*: este projeto roda sem jsdom, e foi assim que o prefill do cardápio quebrou duas vezes
 * (28/08). A tela só desenha o que esta função devolve.
 *
 * ⛔⛔ **E CADA LINHA SAI DA PORTA ÚNICA** (`insumoDoPedido`). Escrever `dose × pedido ÷ loteBase`
 * aqui seria a segunda conta da separação: a tela prometeria um material e a ordem separaria
 * outro — o dono descobriria **com a carne na mão**. É o mesmo motivo de o preview da conversão
 * chamar a porta nas duas pontas.
 */

import { insumoDoPedido } from './escala-da-ordem'

export interface LinhaDoQueSai {
  itemId: string
  nome: string
  unidade: string
  /** o que sai da prateleira pro pedido inteiro — `null` quando não dá pra dizer */
  quantidade: number | null
  /** o que a ficha pede por 1 execução da receita (a régua, mostrada em letra pequena) */
  porLote: number
  /** quanto tem em estoque agora, quando a tela souber */
  saldo?: number | null
  /** ⭐ `true` quando o estoque não cobre — a tela avisa ANTES de o lote começar */
  falta?: boolean
  custoTotal?: number | null
}

export interface ResumoDoQueSai {
  linhas: LinhaDoQueSai[]
  /** Σ do custo, quando TODOS os componentes têm custo médio */
  custoTotal: number | null
  /**
   * ⚠️ quantos componentes estão sem custo médio. A tela DIZ o número em vez de somar só os
   * que têm — total parcial com cara de total é a mentira mais fácil de contar numa tela de
   * dinheiro (a régua do "a definir", nunca 0,01).
   */
  semCusto: number
  /** componentes cujo saldo não cobre o que vai sair */
  faltando: number
}

export interface ComponenteParaSeparar {
  itemId: string
  nome: string
  unidade: string
  /** a dose da ficha por 1 execução da receita */
  porLote: number
  saldo?: number | null
  custoMedio?: number | null
}

/**
 * PURA. O que o pedido tira da prateleira, componente a componente.
 *
 * @param pedido quantas unidades do produto o dono quer
 * @param loteBase quantas unidades 1 execução da receita produz (a régua da ficha)
 */
export function listaDoQueVaiSeparar(
  componentes: ComponenteParaSeparar[],
  pedido: number,
  loteBase: number,
): ResumoDoQueSai {
  const linhas: LinhaDoQueSai[] = componentes.map((c) => {
    // ⭐ A PORTA — e ela devolve `null` quando a conta não se sustenta (pedido ou lote ≤ 0)
    const quantidade = insumoDoPedido({ pedido, loteBase }, c.porLote)
    const custoTotal =
      quantidade != null && c.custoMedio != null && c.custoMedio > 0
        ? Math.round((quantidade * c.custoMedio + 1e-9) * 100) / 100
        : null
    return {
      itemId: c.itemId,
      nome: c.nome,
      unidade: c.unidade,
      quantidade,
      porLote: c.porLote,
      saldo: c.saldo ?? null,
      /**
       * ⚠️ `falta` só é afirmado quando o saldo é CONHECIDO. Sem o saldo não dá pra dizer que
       * falta — e pintar de vermelho por ausência de dado é a família do "erro disfarçado de
       * vazio": o dono iria produzir algo que talvez tenha.
       */
      falta: c.saldo != null && quantidade != null ? c.saldo < quantidade : false,
      custoTotal,
    }
  })

  const semCusto = linhas.filter((l) => l.custoTotal == null).length
  return {
    linhas,
    custoTotal: semCusto === 0 ? Math.round((linhas.reduce((s, l) => s + (l.custoTotal ?? 0), 0) + 1e-9) * 100) / 100 : null,
    semCusto,
    faltando: linhas.filter((l) => l.falta).length,
  }
}
