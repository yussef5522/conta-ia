/**
 * ⭐⭐⭐ COMO O PEDIDO APARECE NA TELA — e a pílula "% do pedido" (05/10/2026).
 *
 * **Ordem do dono (visual v4):** *"PEDIDO SEMPRE REDONDO na exibição: 84,8608 → «85» (round
 * normal; **só exibição** — o valor gravado não muda). Vale em toda tela que mostra pedido em
 * UN."* E: *"a pílula volta com SOBRENOME: «N% do pedido» = fez ÷ pedido, escrito POR EXTENSO
 * dentro da pílula."*
 *
 * ⭐⭐ **POR QUE ISTO É UMA LIB, e não um `Math.round` no JSX:** o pedido aparece em **quatro**
 * telas (home na lista de concluídas, home nas abertas, relatório Por dia e página da ordem).
 * Quatro arredondamentos divergiriam na primeira borda — e aí o dono veria *"85"* num lugar e
 * *"84,86"* noutro **pro mesmo lote**. É a régua do B1 aplicada à exibição.
 *
 * ⛔⛔ **E O ARREDONDAMENTO É GATEADO PELA UNIDADE, nunca cego.** Em UN (contagem de peça) o
 * `84,8608` é artefato de `escala × loteBase` — **ninguém pede 84,8608 porções**, o pedido real
 * é 85. Em **KG/LT** a fração é o dado (`2,858 KG` é o lote da maionese): arredondar ali seria
 * mentir sobre o que foi pedido. Quem responde *"esta unidade é de contagem?"* é o
 * **`aceitaFracao` da casa** (lista FECHADA de inteiras, desde 28/08) — escrever uma segunda
 * lista aqui faria a tela e o campo de digitação discordarem sobre a mesma unidade.
 */
import { aceitaFracao } from '@/lib/stock/quantidade'

/**
 * ⭐ O pedido COMO A TELA MOSTRA: inteiro em unidade de contagem, intacto em peso/volume.
 *
 * ⚠️ `Math.round` (round normal, meio pra cima) porque foi o que o dono pediu — e porque em
 * contagem de peça o vizinho inteiro é a resposta honesta. Nada aqui volta pro banco.
 */
export function pedidoNaTela(valor: number | null | undefined, unidade: string): number | null {
  if (valor == null || !Number.isFinite(valor)) return null
  return aceitaFracao(unidade) ? valor : Math.round(valor)
}

/** ⚠️ 6 casas no fracionável (o teto da casa, `MAX_CASAS`) — a tela nunca mostra menos
 *  precisão do que o campo aceita; no inteiro não sobra casa pra mostrar. */
export function fmtPedido(valor: number | null | undefined, unidade: string): string | null {
  const n = pedidoNaTela(valor, unidade)
  if (n == null) return null
  return n.toLocaleString('pt-BR', { maximumFractionDigits: aceitaFracao(unidade) ? 6 : 0 })
}

export type TomDoPedido = 'verde' | 'ambar' | 'vermelho'

export interface PilulaDoPedido {
  /** inteiro: `fez ÷ pedido × 100` */
  pct: number
  tom: TomDoPedido
  /** ⛔ `true` só nos extremos (<70 ou >130) — é o ⚠ da pílula */
  alarme: boolean
  /** ⭐ o SOBRENOME por extenso DENTRO da pílula: "103% do pedido" */
  texto: string
}

/**
 * ⭐ A RÉGUA DA PÍLULA, ditada pelo dono: **verde 90–110 · âmbar fora · vermelho ⚠ <70 ou >130**.
 *
 * ⛔⛔ **ELA NÃO É A `faixaDoSelo`, e isso é o ponto do sprint.** `faixaDoSelo` (±15%) julga o
 * **rendimento contra a FICHA** — é a régua congelada que o juiz **P8** lê e que vive na tela
 * "Por dia" e no bloco da ordem. Esta aqui responde outra pergunta: *"saiu o que eu pedi?"*.
 * Duas perguntas, dois nomes, duas réguas — e o guard proíbe a home de importar a outra, porque
 * foi exatamente a confusão entre as duas que fez a pílula antiga ser aposentada em 04/10
 * (*"parecia fez÷pedido e não é"*).
 *
 * ⚠️⚠️ **O DENOMINADOR É O PEDIDO EXIBIDO, de propósito.** Com o cru, uma ordem de `pedido 2,4`
 * que fez 2 mostraria *"pedido 2 · fez 2 · **83% do pedido**"* — três números na mesma linha
 * contando histórias diferentes, e o dono leria como defeito. Em unidade de CONTAGEM o pedido
 * de verdade **é** o inteiro; o 2,4 é artefato da escala. *Uma régua, um número.*
 */
export function pilulaDoPedido(
  fez: number,
  pedido: number | null | undefined,
  unidade: string,
): PilulaDoPedido | null {
  const base = pedidoNaTela(pedido, unidade)
  /** ⛔ sem pedido (ou pedido zerado) NÃO tem pílula — dividir por nada é inventar régua */
  if (base == null || base <= 0) return null
  const pct = Math.round((fez / base) * 100)
  const alarme = pct < 70 || pct > 130
  const tom: TomDoPedido = pct >= 90 && pct <= 110 ? 'verde' : alarme ? 'vermelho' : 'ambar'
  return { pct, tom, alarme, texto: `${pct}% do pedido` }
}
