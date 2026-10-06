/**
 * ⭐⭐ COBERTURA E MÍNIMO SUGERIDO (06/10/2026) — as duas contas clássicas do setor, puras.
 *
 * **Ordem do dono:** *"COBERTURA (dá pra ~N dias) = saldo ÷ consumo médio diário dos últimos
 * 30d pelo ledger"* e *"sugestão: ~X KG (consumo médio Y/dia × prazo típico de reposição Z
 * dias + folga)"*, com **Z = mediana dos intervalos entre compras do próprio item**. E a
 * trava: ***SUGERE, nunca grava: o campo é meu.***
 *
 * ⛔⛔ **O QUE CONTA COMO CONSUMO NÃO SE DECIDE AQUI** — vem do `TIPOS` de `real-vs-teorico`,
 * o dono do vocabulário de baldes (REGRA 4). Consumo = **venda + perda/uso interno +
 * (separação − devolução)**: é o que a prateleira perdeu pra a operação. ⚠️ O
 * `PRODUCAO_CONSUMO` fica FORA, pela MESMA razão do `saldo.ts` — ele é transferência interna
 * (o insumo já saiu na separação) e contá-lo dobraria a baixa.
 *
 * ⚠️⚠️ **E NENHUMA DAS DUAS CHUTA.** Sem consumo na janela, sem cobertura (`null`, a tela
 * escreve "—"); com menos de 2 compras, **sem prazo de reposição e sem sugestão** — *"sem
 * compras suficientes = sem sugestão, honesto"* (palavras dele). Número de reposição chutado
 * viraria mínimo gravado, e mínimo errado é alarme falso todo dia.
 */
import { TIPOS } from '../real-vs-teorico'

/** ⭐ a janela da conta de consumo — um número, um lugar */
export const JANELA_CONSUMO_DIAS = 30
/** ⭐ a folga do mínimo sugerido: 30% sobre o consumo do prazo (o colchão clássico do setor) */
export const FOLGA_DO_MINIMO = 0.3
/** ⚠️ com UMA compra só não existe INTERVALO entre compras — prazo precisa de 2 datas */
export const COMPRAS_PARA_PRAZO = 2

/** o mínimo que a lib precisa saber de cada linha — nunca o objeto inteiro da tela */
export interface MovimentoParaConsumo {
  tipo: string
  /** ISO; só a data importa */
  data: string
  quantidade: number
  /**
   * ⭐⭐ O TIPO QUE O ESTORNO DESFEZ — e sem ele a conta MENTE PRA CIMA.
   *
   * Um estorno tem `tipo: 'ESTORNO'`, que não está em nenhum balde; a baixa original está.
   * Logo, uma venda estornada **pela metade** contaria como consumo inteiro, e o item
   * pareceria girar mais do que gira (cobertura menor e mínimo sugerido maior do que o real).
   * ⚠️ O par 100% anulado já não chega aqui (ele vem colapsado, sem mover a prateleira) — este
   * campo é o que resolve o PARCIAL.
   */
  estornoDeTipo?: string | null
}

export interface ConsumoDoItem {
  /** quanto saiu pra operação na janela (positivo) */
  consumoNaJanela: number
  /** consumo médio por dia; `null` quando nada saiu (não é zero — é ausência) */
  porDia: number | null
  diasDaJanela: number
}

const TIPOS_DE_CONSUMO = new Set<string>([...TIPOS.VENDA, ...TIPOS.PERDA, ...TIPOS.SEPARACAO])
const TIPOS_QUE_VOLTAM = new Set<string>([...TIPOS.DEVOLUCAO])
const TIPOS_DE_COMPRA = new Set<string>([...TIPOS.ENTRADA])

const dia = (iso: string) => iso.slice(0, 10)
const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100
const round3 = (n: number) => Math.round((n + 1e-9) * 1000) / 1000

/**
 * ⭐ O CONSUMO MÉDIO DIÁRIO, pela janela.
 *
 * ⚠️ `agora` é PARÂMETRO — o relógio não decide nada aqui dentro (régua da casa desde 13/08:
 * o relógio serve pra exibir "hoje" na tela, nunca pra entrar numa conta sem ser passado).
 */
export function consumoDoItem(movs: MovimentoParaConsumo[], agora: Date, janelaDias = JANELA_CONSUMO_DIAS): ConsumoDoItem {
  const desde = dia(new Date(agora.getTime() - janelaDias * 86_400_000).toISOString())
  let total = 0
  for (const m of movs) {
    if (dia(m.data) < desde) continue
    // ⭐ o estorno conta pelo tipo que ele DESFEZ, com o sinal invertido
    const base = m.estornoDeTipo ?? m.tipo
    const sinal = m.estornoDeTipo ? -1 : 1
    // ⚠️ o SINAL do ledger (saída é negativa) não importa aqui: o consumo é POSITIVO por
    //    definição, e quem decide somar ou subtrair é o BALDE do tipo.
    if (TIPOS_DE_CONSUMO.has(base)) total += sinal * Math.abs(m.quantidade)
    else if (TIPOS_QUE_VOLTAM.has(base)) total -= sinal * Math.abs(m.quantidade)
  }
  const consumo = round3(Math.max(0, total))
  return {
    consumoNaJanela: consumo,
    porDia: consumo > 0 ? round3(consumo / janelaDias) : null,
    diasDaJanela: janelaDias,
  }
}

export interface CoberturaDoItem {
  /** dias que o saldo cobre; `null` quando não dá pra afirmar */
  dias: number | null
  /** ⭐ por que não dá — a tela DIZ, nunca mostra "0 dias" */
  porque: 'SEM_CONSUMO' | 'SALDO_NAO_POSITIVO' | null
}

/**
 * ⛔ COBERTURA SÓ EXISTE COM SALDO POSITIVO **E** CONSUMO MEDIDO.
 *
 * ⚠️ Saldo negativo ou zerado devolve `null` (ordem do dono: *"negativo/zerado = —"*): dizer
 * *"dá pra 0 dias"* num item negativo é afirmar uma previsão sobre um dado impossível.
 */
export function coberturaDoItem(saldo: number, consumo: ConsumoDoItem): CoberturaDoItem {
  if (saldo <= 0) return { dias: null, porque: 'SALDO_NAO_POSITIVO' }
  if (consumo.porDia == null) return { dias: null, porque: 'SEM_CONSUMO' }
  return { dias: Math.floor(saldo / consumo.porDia), porque: null }
}

export interface PrazoDeReposicao {
  /** mediana dos intervalos entre compras, em dias; `null` sem compras suficientes */
  dias: number | null
  comprasUsadas: number
}

/**
 * ⭐ O PRAZO TÍPICO DE REPOSIÇÃO = **MEDIANA** dos intervalos entre compras do próprio item.
 *
 * ⛔⛔ **MEDIANA, não média** — e a razão já foi paga nesta casa duas vezes (o M2 de 02/10 e o
 * rendimento de 03/10): com média, **uma compra atípica puxa a própria referência** e o
 * desvio se esconde. Uma parada de 90 dias no meio de compras semanais não pode virar "o
 * prazo normal".
 *
 * ⚠️ Compras no MESMO dia contam como UMA (duas notas do mesmo caminhão não são dois
 * intervalos) — senão o prazo cairia pra zero e a sugestão de mínimo sumiria.
 */
export function prazoDeReposicao(movs: MovimentoParaConsumo[]): PrazoDeReposicao {
  // ⚠️ compra ESTORNADA não é compra: ela não repôs nada, então não gerou intervalo
  const dias = [...new Set(
    movs.filter((m) => !m.estornoDeTipo && TIPOS_DE_COMPRA.has(m.tipo)).map((m) => dia(m.data)),
  )].sort()
  if (dias.length < COMPRAS_PARA_PRAZO) return { dias: null, comprasUsadas: dias.length }
  const intervalos: number[] = []
  for (let i = 1; i < dias.length; i++) {
    const d = (Date.parse(`${dias[i]}T00:00:00Z`) - Date.parse(`${dias[i - 1]}T00:00:00Z`)) / 86_400_000
    if (d > 0) intervalos.push(d)
  }
  if (!intervalos.length) return { dias: null, comprasUsadas: dias.length }
  intervalos.sort((a, b) => a - b)
  const meio = Math.floor(intervalos.length / 2)
  const mediana = intervalos.length % 2 ? intervalos[meio] : (intervalos[meio - 1] + intervalos[meio]) / 2
  return { dias: Math.round(mediana), comprasUsadas: dias.length }
}

export interface MinimoSugerido {
  /** a sugestão; `null` quando falta consumo OU prazo — nunca chuta */
  minimo: number | null
  /** ⭐ a conta ESCRITA, pra o dono poder conferir em vez de acreditar */
  conta: string | null
  porDia: number | null
  prazoDias: number | null
}

/**
 * ⭐⭐ `mínimo ≈ consumo/dia × prazo de reposição × (1 + folga)`.
 *
 * ⛔ **SUGERE, NUNCA GRAVA** (ordem do dono: *"o campo é meu"*). Esta função devolve texto e
 * número; quem escreve no `estoqueMin` é o clique dele no editor de mín/máx, que não mudou.
 */
export function minimoSugerido(consumo: ConsumoDoItem, prazo: PrazoDeReposicao, unidade: string): MinimoSugerido {
  if (consumo.porDia == null || prazo.dias == null) {
    return { minimo: null, conta: null, porDia: consumo.porDia, prazoDias: prazo.dias }
  }
  const bruto = consumo.porDia * prazo.dias * (1 + FOLGA_DO_MINIMO)
  const n = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
  return {
    minimo: round2(bruto),
    conta: `consumo médio ${n(consumo.porDia)} ${unidade}/dia × prazo típico de reposição ${prazo.dias} dia(s) + ${Math.round(FOLGA_DO_MINIMO * 100)}% de folga`,
    porDia: consumo.porDia,
    prazoDias: prazo.dias,
  }
}
