/**
 * ⭐⭐⭐ "QUAL É O PEDIDO DESTA ORDEM?" — o dono ÚNICO da pergunta (04/10/2026).
 *
 * **Pedido do dono (item 2):** *"A ordem sempre mostra o pedido, do início ao fim: criar com
 * 'quero produzir 80 UN', em produção 'pedido: 80 UN', e na conclusão 'pedido 80 · separado X ·
 * produzido 78 · 98%'."*
 *
 * ═══ ⛔⛔ O BURACO MEDIDO EM PROD, E ELE É DE ESCRITA ═══
 *
 * A tabela `stock_ordem_meta` existe desde **13/09**, tem **DOIS leitores** (`lotes.ts` e
 * `dia-ao-vivo.ts`) e **ZERO WRITERS** — **0 linhas em 471 ordens**. Ou seja: o relatório por
 * tarefa já sabia mostrar *"pedido 130 → entregue 137 (105%)"* e **o `pedido` era SEMPRE null**,
 * então o % nunca aparecia. *Campo que ninguém escreve é promessa que a tela não cumpre.*
 *
 * ═══ ⭐⭐ DUAS FONTES, E A ORIGEM VAI JUNTO — NUNCA MISTURADAS EM SILÊNCIO ═══
 *
 * - **DECLARADO** — o número que o dono digitou (`stock_ordem_meta`). É o pedido de verdade.
 * - **DERIVADO** — `escala × loteBase` pela porta (`saidaEsperadaDaFicha`). É o que a ficha
 *   prometia; o melhor disponível nas **471 ordens que nasceram antes desta tela existir**.
 *
 * ⛔⛔ **A ORIGEM É CAMPO, não detalhe de implementação.** Sem ela, *"pedido 80"* significaria
 * duas coisas diferentes na mesma tela — e o dono não teria como saber se os 98% comparam com o
 * que ELE pediu ou com o que o sistema calculou. É a mesma disciplina do `~previsto` dos
 * empréstimos e do selo `[sistema]` do Fluxo: **visível, usado, e dizendo de onde veio**.
 *
 * ⚠️ E o DERIVADO não vira DECLARADO com o tempo: ordem antiga continua marcada como derivada
 * pra sempre. Carimbar meta retroativa seria inventar um pedido que ninguém fez.
 */

import { saidaEsperadaDaFicha } from './escala-da-ordem'

export type OrigemDoPedido = 'DECLARADO' | 'DERIVADO'

export interface PedidoResolvido {
  /** quantas unidades do produto a ordem pediu; `null` quando não dá pra dizer */
  unidades: number | null
  origem: OrigemDoPedido | null
  /** a frase curta que a tela mostra ao lado do número */
  comoSoube: string | null
}

export interface EntradaDoPedido {
  /** o que a `stock_ordem_meta` guarda pra esta ordem (`null` = nunca registrado) */
  meta: number | null
  /** o `escalaReceitas` gravado na ordem */
  escala: number
  /** o `loteBase` da VERSÃO que a ordem congelou */
  loteBase: number
}

/**
 * PURA. O pedido da ordem, com a origem dita.
 *
 * ⭐⭐ **O DERIVADO SAI DA PORTA** (`saidaEsperadaDaFicha`), nunca de `escala * loteBase` escrito
 * aqui. Se divergisse, a tela diria um pedido e a eficiência compararia com outro — e o dono
 * veria 98% de um número que ele não reconhece. É a lição do comentário mentiroso de
 * `eficienciaDaOrdem` (03/10): *promessa de fonte única sem chamar a fonte é pior que nenhuma*.
 */
export function pedidoDaOrdem(e: EntradaDoPedido): PedidoResolvido {
  if (e.meta != null && e.meta > 0) {
    return { unidades: e.meta, origem: 'DECLARADO', comoSoube: 'você pediu esta quantidade ao criar a ordem' }
  }
  const derivado = saidaEsperadaDaFicha(e.escala, e.loteBase)
  if (derivado != null && derivado > 0) {
    return {
      unidades: derivado,
      origem: 'DERIVADO',
      comoSoube: 'calculado pela ficha (esta ordem nasceu antes do campo de pedido existir)',
    }
  }
  /**
   * ⛔ `null`, NUNCA zero. "Pedido 0" leria como *"não pedi nada"*, e o que houve foi *"não dá
   * pra dizer"* — é a mesma régua do "sem contagem" do estoque e do "a apurar" das vendas.
   */
  return { unidades: null, origem: null, comoSoube: null }
}

/**
 * PURA. A frase do ciclo fechado que o dono pediu na conclusão:
 * *"pedido 80 · separado R$ 412,30 · produziu 78 · 98%"*.
 *
 * ⚠️⚠️ **O "SEPARADO" É EM R$, E ISSO FOI UMA CORREÇÃO DE ROTA — a 1ª versão somava QUANTIDADE.**
 * Os componentes de uma ordem estão em unidades diferentes (coxão em KG, caixa em UN, molho em
 * LT): somá-los num número só é o pecado que esta casa proíbe desde 13/09 (`somarQuantidades`,
 * o *"rodrigo 1.415,84 un"* que era porção somada com massa — *"aquele `,84` era um número que
 * não existe"*). **Dinheiro soma; grandeza física, não.**
 *
 * ⚠️ `separado` é OPCIONAL porque só existe depois da separação — e **ausência não é zero**:
 * imprimir "separado R$ 0,00" numa ordem recém-criada afirmaria que ninguém tirou nada da
 * câmara, quando a verdade é que ainda não chegou a hora.
 */
export function fraseDoCiclo(p: {
  pedido: number | null
  unidadeProduto: string
  /** o CUSTO do que saiu da prateleira pra esta ordem (R$) — nunca uma soma de quantidades */
  separadoReais?: number | null
  produzido?: number | null
}): string {
  const n = (x: number) => x.toLocaleString('pt-BR', { maximumFractionDigits: 4 })
  const partes: string[] = []
  partes.push(p.pedido != null ? `pedido ${n(p.pedido)} ${p.unidadeProduto}` : 'pedido: a apurar')
  if (p.separadoReais != null) {
    partes.push(`separado ${p.separadoReais.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`)
  }
  if (p.produzido != null) {
    partes.push(`produziu ${n(p.produzido)}`)
    if (p.pedido != null && p.pedido > 0) {
      partes.push(`${Math.round((p.produzido / p.pedido) * 100)}%`)
    }
  }
  return partes.join(' · ')
}
