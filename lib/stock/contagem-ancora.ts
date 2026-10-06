/**
 * ⛔⛔⛔ A CONTAGEM É A ÂNCORA — ela SEMPRE entra (05/10/2026). **Lei geral do dono.**
 *
 * **Ordem, ao pé da letra:** *"Toda contagem lançada ENTRA, sem exceção de estado do item:
 * saldo positivo, zero ou NEGATIVO (qtd e/ou R$). (a) a contagem entra cruzando o que precisar:
 * saldo vira o CONTADO; a diferença vira LINHA DE AJUSTE própria, inclusive atravessando o
 * zero; resíduo de dinheiro negativo absorvido como linha de ajuste de valor — **nunca por
 * dentro do custo**; (b) valoração do saldo novo pelo último custo médio conhecido do item (se
 * nunca houve compra: custo «a definir» honesto); (c) o FREIO continua freando SEM bloquear.
 * Nenhum caminho termina em recusa."*
 *
 * ⭐ É a régua dos líderes mundiais (SAP/Oracle/NetSuite): **a contagem física é a âncora dos
 * registros**; o sistema cria o ajuste de CORREÇÃO e o saldo vira o contado. Negativo vira
 * **investigação**, nunca bloqueio.
 *
 * ⛔⛔ **E ISTO INVERTE, COM O MOTIVO ESCRITO, A DECISÃO DE 22/09** — a "porta do negativo",
 * que RECUSAVA a contagem sobre item negativo com o argumento *"contar por cima ENTERRA o lote
 * que ninguém lançou"*. O argumento era bom e estava **meio certo**: enterrar calado é mesmo o
 * risco. O que faltava era a outra metade — **o aviso de investigação** —, e sem ela a cura
 * virou doença: o dono ficava com 6 kg de fermento na prateleira, o sistema dizia −3,56, e
 * **não havia gesto nenhum** que fechasse a diferença (a compra não existia pra lançar).
 * ***Recusa sem porta é beco, e beco é o que esta casa mais paga.***
 *
 * ⚠️⚠️ **O QUE A MEDIÇÃO EM PROD MOSTROU, e que mudou o desenho:** nos 8 itens negativos da
 * Caçula o **`custoMedio` vem `null`** (o `saldo.ts` se recusa, com razão, a dividir valor
 * negativo por saldo negativo e devolver um positivo plausível). Com ele em zero, o
 * `AJUSTE_CONTAGEM` entraria com **R$ 0,00**: a quantidade consertava e **o dinheiro continuava
 * quebrado**. É por isso que a valoração (item b) não é detalhe — é metade da lei.
 */

import { ENTRADAS_QUE_CONSERTAM } from './entrada-cruza-o-zero'

const round2 = (n: number) => Math.round(n * 100) / 100
const round3 = (n: number) => Math.round(n * 1000) / 1000

/** ⭐ o tipo do movimento da contagem — o que a torna ÂNCORA (e não "uma entrada") */
export const TIPO_CONTAGEM = 'AJUSTE_CONTAGEM'

/** ⭐ este movimento é a contagem, a âncora dos registros? */
export function ehAncoraDeContagem(tipo: string): boolean {
  return tipo === TIPO_CONTAGEM
}

/**
 * ⭐⭐ DE ONDE SAI O "ÚLTIMO CUSTO CONHECIDO" — os MESMOS tipos que `ENTRADAS_QUE_CONSERTAM`
 * (REGRA 4). ⛔ E **só** eles: uma `BAIXA_VENDA` também carrega `custoUnitario`, mas aquele é
 * o custo MÉDIO do instante — um número derivado. O que se quer aqui é **o que se pagou ou o
 * que custou produzir**, que é o único custo que alguém pode defender num item cuja história
 * está torta.
 */
export const TIPOS_COM_CUSTO_CONHECIDO: readonly string[] = ENTRADAS_QUE_CONSERTAM

export type BaseDaValoracao = 'CUSTO_MEDIO' | 'ULTIMO_CONHECIDO' | 'A_DEFINIR'

export interface EstadoDaContagem {
  /** saldo do sistema no instante (o snapshot que o contador está vendo) */
  saldoSistema: number
  /** valor do item no ledger agora (pode ser negativo — é o caso que interessa) */
  valorAtual: number
  /** o que a pessoa contou (≥ 0) */
  contado: number
  /** custo médio do item, quando ele EXISTE (null em item negativo, de propósito) */
  custoMedio: number | null
  /** o `custoUnitario` da última ENTRADA/PRODUÇÃO do item — `null` se nunca houve */
  ultimoCustoConhecido: number | null
}

export interface ValoracaoDaContagem {
  divergencia: number
  /** o custo unitário que a LINHA DE AJUSTE carrega */
  custoUnitario: number
  /** o dinheiro da linha de ajuste da quantidade */
  custoTotal: number
  /**
   * ⭐ a LINHA À PARTE: o dinheiro que sobra pendurado depois do ajuste da quantidade.
   * Positivo ou negativo; `0` quando não há o que absorver.
   */
  residuo: number
  /** o valor do item DEPOIS das duas linhas */
  valorFinal: number
  /** em que custo a valoração se apoiou — a tela DIZ isso, nunca esconde */
  base: BaseDaValoracao
  /** ⭐ o item estava num estado impossível/negativo antes desta contagem? */
  eraNegativo: boolean
}

/**
 * ⭐⭐⭐ A VALORAÇÃO, PURA — e ela é o **DONO ÚNICO** do número: o FREIO e o LEDGER leem a
 * MESMA saída.
 *
 * ⚠️ Duas leituras divergiriam exatamente onde dói: o freio avaliaria a correção por um valor
 * (hoje R$ 0,00, porque o `custoMedio` é nulo) e o ledger gravaria outro. O freio deixaria de
 * perguntar justamente na correção grande — a doença do B1, em forma de alarme que cala.
 *
 * **O caminho NORMAL não muda em nada:** item com custo médio e sem dinheiro negativo usa o
 * custo médio, resíduo zero, exatamente como desde 23/08.
 *
 * ⛔⛔ **E O ESTADO NEGATIVO É ANCORADO EM DUAS LINHAS, nunca em uma:**
 * 1. `AJUSTE_CONTAGEM` leva a quantidade, valorada no **último custo CONHECIDO** — um custo
 *    que alguém pagou de verdade;
 * 2. `AJUSTE_RESIDUO` leva o que sobra, pra o item **terminar valendo `contado × custo`**.
 *
 * ⚠️ Enfiar o resíduo no `custoUnitario` da linha 1 (o atalho óbvio) daria o número certo no
 * total e **um custo por unidade inventado** — no fermento, R$ 24,63/kg num item que custa
 * R$ 34,00. O custo médio é o que alimenta ficha, cardápio e CMV: *"nunca por dentro do
 * custo"* é a parte da ordem que protege todo o resto.
 */
export function valorarContagem(e: EstadoDaContagem): ValoracaoDaContagem {
  const divergencia = round3(e.contado - e.saldoSistema)
  /**
   * ⭐ "Impossível" é o que esta casa já nomeia assim: saldo negativo, **ou** dinheiro negativo
   * com saldo em pé. ⚠️ E custo médio ≤ 0 entra junto: ele é derivado de um dos dois, e usá-lo
   * propagaria a ficção pra dentro da correção.
   */
  const eraNegativo = e.saldoSistema < 0 || e.valorAtual < -0.01 || (e.custoMedio != null && e.custoMedio <= 0)

  if (!eraNegativo) {
    // ⭐ o caminho de todo dia, intocado desde 23/08
    const cu = e.custoMedio ?? 0
    const total = round2(divergencia * cu)
    return {
      divergencia, custoUnitario: cu, custoTotal: total, residuo: 0,
      valorFinal: round2(e.valorAtual + total),
      base: e.custoMedio == null ? 'A_DEFINIR' : 'CUSTO_MEDIO',
      eraNegativo: false,
    }
  }

  /**
   * ⛔ **SEM NENHUM CUSTO CONHECIDO, O CUSTO É "A DEFINIR" — honesto, como a casa já faz.**
   * Chutar um número aqui poria preço inventado na ficha e no CMV; o zero é a ausência dita
   * em voz alta, e a 1ª compra ensina o custo (a régua do item que nasce sem custo).
   */
  const base: BaseDaValoracao = e.ultimoCustoConhecido != null && e.ultimoCustoConhecido > 0 ? 'ULTIMO_CONHECIDO' : 'A_DEFINIR'
  const custo = base === 'ULTIMO_CONHECIDO' ? (e.ultimoCustoConhecido as number) : 0

  const custoTotal = round2(divergencia * custo)
  // ⭐ o ALVO é a ordem do dono: *"valoração do saldo NOVO pelo último custo conhecido"*
  const alvo = round2(e.contado * custo)
  const residuo = round2(alvo - (e.valorAtual + custoTotal))

  return {
    divergencia, custoUnitario: custo, custoTotal,
    // ⚠️ resíduo de centavo não vira linha: 0,001 de quantidade por um centavo é ruído no extrato
    residuo: Math.abs(residuo) <= 0.01 ? 0 : residuo,
    valorFinal: alvo,
    base,
    eraNegativo: true,
  }
}

/**
 * ⛔⛔ OS MOTIVOS — **lista FECHADA, em TypeScript e não num CHECK do banco.**
 *
 * ⚠️ É a cicatriz de 21/09: o `CHECK (lista IN ('CAROS','PORCOES'))` virou PAREDE **um dia
 * depois**, quando o dono pediu a 3ª lista. Motivo novo aqui se resolve editando um array; o
 * banco só garante a FORMA (não-vazio).
 *
 * ⭐ E o *"não sei"* é um motivo de primeira classe, não um buraco: **obrigar a escolher uma
 * causa que a pessoa não conhece é fabricar diagnóstico**, e diagnóstico inventado é pior que
 * ausência — ele encerra a investigação que o aviso do sininho existe pra abrir.
 */
export const MOTIVOS_DO_NEGATIVO = [
  { codigo: 'FICHA_ERRADA', rotulo: 'ficha com dose errada — consumo virtual' },
  { codigo: 'PERDA', rotulo: 'perda/quebra que não foi lançada' },
  { codigo: 'FALTA_LANCAMENTO', rotulo: 'falta lançar entrada (compra ou produção)' },
  { codigo: 'NAO_SEI', rotulo: 'não sei — investigar depois' },
] as const

export type MotivoDoNegativo = (typeof MOTIVOS_DO_NEGATIVO)[number]['codigo']

export function ehMotivoDoNegativo(x: unknown): x is MotivoDoNegativo {
  return typeof x === 'string' && MOTIVOS_DO_NEGATIVO.some((m) => m.codigo === x)
}

export function rotuloDoMotivo(codigo: string): string {
  return MOTIVOS_DO_NEGATIVO.find((m) => m.codigo === codigo)?.rotulo ?? codigo
}

/**
 * ⭐ A frase que a tela mostra quando pede o motivo — **com a conta na tela**, que é o que a
 * torna respondível (a régua do `confirmouSanidade`, 05/09).
 *
 * ⚠️ Ela diz que a contagem VAI ENTRAR. Pedir o motivo sem prometer o desfecho se leria como
 * mais uma recusa, e foi a recusa que criou o beco.
 */
export function fraseDoMotivo(nome: string, saldoAntes: number, valorAtual: number, unidade: string): string {
  const brl = (n: number) => `R$ ${Math.abs(n).toFixed(2).replace('.', ',')}`
  const dinheiro = valorAtual < -0.01 ? ` e ${brl(valorAtual)} de custo pendurado` : ''
  return (
    `«${nome}» está em ${saldoAntes} ${unidade}${dinheiro} — a tua contagem vai entrar e virar ` +
    `o saldo. Antes, diga o que você acha que causou o negativo (1 toque): isso fica gravado na ` +
    `contagem e abre a investigação.`
  )
}
