// ⭐⭐⭐ A ENTRADA QUE CRUZA O ZERO LIMPA O RESÍDUO (23/09/2026) — a régua IRMÃ.
//
// **O dono, com a nota do ALAN parada:** *"o guard recusa a entrada do sal: «ficaria com
// 2 KG e valor R$ −0,22 — dinheiro negativo com saldo positivo». A régua que falta (irmã do
// zerar-quantidade-zera-valor): ENTRADA que leva o saldo de negativo a positivo ABSORVE o
// resíduo. Cruzar o zero começa vida nova."*
//
// ⭐ **POR QUE A IRMÃ E NÃO A MESMA:** `avaliarResiduo` (19/09) responde *"a BAIXA pode
// levar o resíduo junto?"* — e ela só diz sim **quando a quantidade vai a ZERO**, porque com
// saldo remanescente um valor negativo é a compra que falta, e zerá-lo esconderia o buraco.
// Aqui a pergunta é a oposta: *"a ENTRADA pode limpar o que ficou pendurado?"* — e a
// resposta é sim **justamente porque a compra que faltava acabou de chegar**.
//
// ⛔⛔ **E O RESÍDUO NÃO ENTRA NO CUSTO DA NOTA.** A baixa absorve somando no `custoTotal` do
// próprio movimento (`baixa-venda.ts`); aqui isso seria **errado duas vezes**: (a) quebraria
// o CHECK do ledger (`|custoTotal − qtd × custoUnit| ≤ 0,01`), e (b) quebraria o **E16**, o
// invariante que exige `Σ(ENTRADA_NF) da nota == Σ(vProd)` — a nota passaria a "valer" 22
// centavos a mais do que o documento assinado diz. ***A nota é FATO e não se reescreve.***
// O ajuste é um movimento PRÓPRIO, com tipo próprio e motivo escrito.
//
// ⚠️ **O TETO É O MESMO LIMITE MATEMÁTICO**, proporcional ao que saiu sem lastro
// (`|saldoAntes| × meio centavo por unidade`, com piso). Acima dele **não é centavo de
// arredondamento: é dinheiro que saiu e nunca entrou** — e aí a régua **PERGUNTA com a conta
// na tela**, nunca recusa cega (a régua do `confirmouSanidade`, 05/09). Beco é o que este
// sprint inteiro existe pra matar.

import { ERRO_POR_UNIDADE, PISO } from './residuo-de-centavos'

/** ⭐ o tipo do movimento de ajuste — próprio, pra o extrato e o Real vs Teórico o nomearem */
export const TIPO_AJUSTE_RESIDUO = 'AJUSTE_RESIDUO'

/**
 * ⛔⛔⛔ **A FRONTEIRA — E ELA VEIO DE UM TESTE VERMELHO, NÃO DE UM RACIOCÍNIO MEU.**
 *
 * A 1ª versão desta régua valia pra QUALQUER movimento que cruzasse o zero — e engoliu a
 * **porta do negativo** (22/09): a CONTAGEM sobre um item negativo passou a perguntar sobre
 * centavos em vez de dizer *"vendeu sem ter produção registrada — contar por cima ENTERRA o
 * lote que ninguém lançou"*.
 *
 * ⭐ A régua do dono é ***"a ENTRADA é o conserto"*** — a coisa que faltava CHEGOU:
 * - **`ENTRADA_NF` / `ENTRADA_MANUAL`** — a compra que faltava chegou;
 * - **`PRODUCAO_GERACAO`** — a produção que faltava foi lançada (é literalmente a porta
 *   que a recusa do intermediário negativo oferece);
 * - **`DEVOLUCAO_PRODUCAO`** — o material voltou da câmara.
 *
 * ⛔ **`AJUSTE_CONTAGEM` fica FORA de propósito.** Contar por cima não é o conserto: é o
 * enterro. Ali a porta continua sendo a de 22/09, e o dono já tem o caminho.
 */
export const ENTRADAS_QUE_CONSERTAM: readonly string[] = [
  'ENTRADA_NF', 'ENTRADA_MANUAL', 'PRODUCAO_GERACAO', 'DEVOLUCAO_PRODUCAO',
]

/** ⭐ este movimento é do tipo que conserta um saldo negativo? */
export function ehEntradaQueConserta(tipo: string): boolean {
  return ENTRADAS_QUE_CONSERTAM.includes(tipo)
}

export interface EstadoDaEntrada {
  /** saldo ANTES da entrada (negativo é o caso que interessa) */
  saldoAntes: number
  /** valor ANTES da entrada */
  valorAntes: number
  /** quanto ENTRA (positivo) */
  qtdDaEntrada: number
  /** quanto de dinheiro a entrada traz (a nota; pode ser 0 numa bonificação) */
  valorDaEntrada: number
}

export interface VeredictoDaEntrada {
  saldoDepois: number
  valorDepois: number
  /** ⭐ o saldo saiu do negativo e chegou em >= 0? só aí começa vida nova */
  cruzaOZero: boolean
  /** o dinheiro negativo que ficaria pendurado (negativo, ou 0) */
  residuo: number
  /** o teto que ESTE item aceita absorver calado */
  teto: number
  decisao: 'OK' | 'AJUSTA_RESIDUO' | 'PERGUNTA' | 'RECUSA'
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * ⭐⭐ A DECISÃO, pura.
 *
 * - **OK** — não sobra dinheiro negativo; nada a fazer.
 * - **AJUSTA_RESIDUO** — cruzou o zero e o resíduo cabe no teto: absorve e **registra**.
 * - **PERGUNTA** — cruzou o zero e o resíduo é maior: a tela mostra a conta e o dono confirma.
 * - **RECUSA** — ⛔ **não cruzou o zero**: o saldo já era positivo e o valor está negativo.
 *   Esse é o caso do FERMENTO (16/09) — consumo lançado antes da compra —, e absorver ali
 *   **esconderia a entrada que falta** num item que continua na prateleira.
 */
export function avaliarEntrada(e: EstadoDaEntrada): VeredictoDaEntrada {
  const saldoDepois = round2(e.saldoAntes + e.qtdDaEntrada)
  const valorDepois = round2(e.valorAntes + e.valorDaEntrada)
  const cruzaOZero = e.saldoAntes < 0 && saldoDepois >= 0
  const teto = Math.max(PISO, round2(Math.abs(e.saldoAntes) * ERRO_POR_UNIDADE))
  const base = { saldoDepois, valorDepois, cruzaOZero, residuo: valorDepois, teto }

  if (valorDepois >= -0.01) return { ...base, decisao: 'OK' }
  if (!cruzaOZero) return { ...base, decisao: 'RECUSA' }
  if (Math.abs(valorDepois) <= teto) return { ...base, decisao: 'AJUSTA_RESIDUO' }
  return { ...base, decisao: 'PERGUNTA' }
}

/**
 * ⭐ A frase da pergunta — com **a conta inteira na tela**, que é o que a torna respondível.
 *
 * ⚠️ Ela diz o que o ajuste FAZ (zera o pendurado) e o que ele NÃO faz (não mexe na nota),
 * porque *"o número sem a régua é pior que ausência"*.
 */
export function frasePergunta(v: VeredictoDaEntrada, nome: string, unidade: string): string {
  const brl = (n: number) => `R$ ${Math.abs(n).toFixed(2).replace('.', ',')}`
  return (
    `«${nome}» estava negativo e tem ${brl(v.residuo)} de custo pendurado — dinheiro que ` +
    `saiu sem nota que o lastreasse. Esta entrada põe o saldo em ${v.saldoDepois} ${unidade} ` +
    `e começa vida nova. Confirme pra eu zerar os ${brl(v.residuo)} como ajuste registrado ` +
    `(a nota entra pelo valor dela; o ajuste é uma linha à parte).`
  )
}
