/**
 * ⭐⭐⭐ O MONTADOR DE PIZZA DE TESTE — PURO, e SÓ SIMULAÇÃO (item 3 do v2, 07/10/2026).
 *
 * ⛔⛔ NADA AQUI GRAVA E NADA BAIXA ESTOQUE. É a bancada onde o dono descobre, ANTES de pôr
 * no cardápio, quanto custa uma grande de filé com bacon e quanto sobra dela no iFood. A
 * garantia é de FORMA: esta lib não conhece `prisma`, não recebe client e não tem como
 * escrever — o guard afirma isso.
 *
 * ⭐⭐ A REGRA É A DE 02/09, SEM FATOR: **1 ocorrência = 1 explosão**. Uma grande de 2 sabores
 * consome a ficha de CADA sabor UMA vez — não metade de cada. ⛔ Dividir por nº de fatias
 * seria ressuscitar o fator por tamanho que morreu em 07/10, e o relatório de complementos
 * (que é quem baixa o sabor de verdade) conta ocorrência, nunca fração.
 *
 * ⚠️ E o custo da BASE vem da ficha do cardápio daquele tamanho (massa + queijo + caixa), que
 * é o que o retrato de prod mostrou existir: `Pizza Grande (35cm)` = 2 × porção de queijo,
 * `PIZZA GRANDE PRECINHO` = 2 × queijo + 2 × metade de massa. O sabor acrescenta a proteína —
 * é por isso que `MUSSARELA` custa R$ 0,04 e `FILE COM BACON` R$ 13,18.
 */
import type { CanalDeVenda, SobraNoCanal } from './canais'
import { sobraNoCanal, ordenarCanais } from './canais'
import type { TamanhoDePizza } from './tamanhos'

export interface SaborDisponivel {
  fichaId: string
  nome: string
  /** `null` = algum insumo da ficha não tem custo médio → o total da pizza fica "a apurar" */
  custo: number | null
  familia: string
  icone: string
  /** ⚠️ sabor que o PDV vende e que ainda NÃO tem ficha — entra com selo âmbar, nunca escondido */
  temFicha: boolean
}

export interface FatiaMontada {
  indice: number
  sabor: SaborDisponivel | null
  /** o custo DAQUELA fatia — é o que a tela escreve dentro dela */
  custo: number | null
}

export type MotivoIncompleto = 'SEM_BASE' | 'SEM_SABORES_DECLARADOS' | 'FATIA_VAZIA' | 'SABOR_SEM_CUSTO'

export interface PizzaMontada {
  tamanho: string
  fatias: FatiaMontada[]
  custoBase: number | null
  /** Σ dos sabores escolhidos */
  custoSabores: number | null
  /** ⛔ `null` quando falta QUALQUER peça — nunca um total parcial com cara de total */
  custoTotal: number | null
  /** ⭐ o que dá pra afirmar hoje, mesmo incompleto — e a tela DIZ que é piso */
  custoParcial: number
  /** ⚠️ cada ausência com NOME: alarme sem o porquê manda o dono procurar no lugar errado */
  incompleto: { motivo: MotivoIncompleto; frase: string }[]
  /** a sobra por canal, com o preço que o dono digitou */
  precoVenda: number | null
  canais: SobraNoCanal[]
}

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

export function montarPizza(opts: {
  tamanho: TamanhoDePizza
  /** o sabor de cada fatia, na ordem — `null` = fatia ainda vazia */
  escolhas: readonly (SaborDisponivel | null)[]
  precoVenda: number | null
  canais: readonly CanalDeVenda[]
}): PizzaMontada {
  const { tamanho, escolhas, precoVenda, canais } = opts
  const incompleto: PizzaMontada['incompleto'] = []

  // ⛔ sem o nº de sabores declarado não existe pizza pra desenhar — e a régua diz isso em
  // vez de chutar 1 fatia (que faria uma família de 3 entrar no sistema como 1)
  if (tamanho.sabores <= 0) {
    incompleto.push({
      motivo: 'SEM_SABORES_DECLARADOS',
      frase: `quantos sabores a ${tamanho.tamanho.toLowerCase()} obriga? declare pra eu desenhar as fatias`,
    })
  }

  const n = Math.max(0, tamanho.sabores)
  const fatias: FatiaMontada[] = Array.from({ length: n }, (_, i) => {
    const sabor = escolhas[i] ?? null
    return { indice: i, sabor, custo: sabor?.custo ?? null }
  })

  const vazias = fatias.filter((f) => f.sabor == null).length
  if (vazias > 0) {
    incompleto.push({
      motivo: 'FATIA_VAZIA',
      frase: `${vazias} de ${n} fatia${n > 1 ? 's' : ''} ainda sem sabor`,
    })
  }
  const semCusto = fatias.filter((f) => f.sabor != null && f.sabor.custo == null)
  for (const f of semCusto) {
    incompleto.push({
      motivo: 'SABOR_SEM_CUSTO',
      frase: `${f.sabor!.nome}: algum insumo da ficha não tem custo médio — a 1ª nota resolve`,
    })
  }

  const custoBase = tamanho.base?.custo ?? null
  if (tamanho.base == null) {
    incompleto.push({
      motivo: 'SEM_BASE',
      frase: `qual ficha é a base da ${tamanho.tamanho.toLowerCase()} (massa + queijo + caixa)? aponte pra eu somar`,
    })
  } else if (custoBase == null) {
    incompleto.push({
      motivo: 'SABOR_SEM_CUSTO',
      frase: `a base "${tamanho.base.nome}" tem insumo sem custo médio`,
    })
  }

  // ⭐ 1 OCORRÊNCIA = 1 EXPLOSÃO: soma o custo de cada sabor escolhido, sem dividir por nada
  let somaSabores = 0
  let saboresFechados = true
  for (const f of fatias) {
    if (f.sabor == null) { saboresFechados = false; continue }
    if (f.sabor.custo == null) { saboresFechados = false; continue }
    somaSabores += f.sabor.custo
  }
  const custoSabores = saboresFechados && n > 0 ? round2(somaSabores) : null

  // ⛔ o total só existe quando TUDO fecha; o parcial é o que dá pra afirmar, e a tela o
  // apresenta como PISO ("pelo menos"), nunca como o custo
  const custoTotal =
    custoBase != null && custoSabores != null && incompleto.length === 0
      ? round2(custoBase + custoSabores)
      : null
  const custoParcial = round2((custoBase ?? 0) + somaSabores)

  /**
   * ⚠️ A SOBRA POR CANAL SÓ EXISTE COM O CUSTO FECHADO. Com o parcial ela seria otimista —
   * e otimista justamente no número que o dono usa pra decidir o preço de cardápio.
   */
  const canaisCalc = ordenarCanais(canais).map((c) => sobraNoCanal(precoVenda, custoTotal, c))

  return {
    tamanho: tamanho.tamanho,
    fatias,
    custoBase,
    custoSabores,
    custoTotal,
    custoParcial,
    incompleto,
    precoVenda,
    canais: canaisCalc,
  }
}

/**
 * ⭐ A ORDEM DOS SABORES NA LISTA: **com ficha primeiro** (é o que dá pra montar hoje), e
 * dentro de cada grupo por nome. ⚠️ O sem-ficha NÃO é escondido — ele entra com selo âmbar,
 * porque tocar nele é o atalho pra criar a ficha, que é o trabalho que sobe a cobertura.
 */
export function ordenarSabores(sabores: readonly SaborDisponivel[]): SaborDisponivel[] {
  return [...sabores].sort((a, b) => {
    if (a.temFicha !== b.temFicha) return a.temFicha ? -1 : 1
    return a.nome.localeCompare(b.nome, 'pt-BR')
  })
}
