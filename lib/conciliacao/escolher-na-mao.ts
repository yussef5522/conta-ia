// ⭐⭐⭐ ESCOLHER NA MÃO — o card do Find & Match por fornecedor (10/09/2026).
//
// **O dono, no mock:** linha do banco em cima (chão frio) → notas ABERTAS do fornecedor com
// checkbox, em **dois grupos: VENCIDAS e A VENCER** → rodapé sticky com a conta viva.
//
// ⛔⛔ **AS DUAS COISAS QUE ESTE ARQUIVO EXISTE PRA IMPEDIR:**
//
//  1. **"CONCILIAR" HABILITADO COM DIFERENÇA.** O botão só acende com a diferença em ZERO
//     — ou com ela RESOLVIDA COM NOME (juros/tarifa/desconto), que é outra coisa. Deixar
//     conciliar com sobra é gravar um número que ninguém consegue defender depois.
//  2. **O SISTEMA ESCOLHENDO AS NOTAS.** O atalho ⭐ só aparece quando existe **UMA**
//     combinação que crava; duas que fecham é a resposta *"não sei qual foi"* — a mesma
//     régua do lote. E mesmo com o atalho, **ele só MARCA as caixas**: o Conciliar continua
//     sendo do dono.
//
// ⚠️ **A VENCER ENTRA NA LISTA DE PROPÓSITO** — não é folga de régua, é o pagamento real:
// o dono paga o fornecedor de uma vez e a nota que ainda não venceu vai junto. Esconder as
// "a vencer" faria o card nunca fechar nesses casos, que são a maioria dos pequenos.

import { combinacoesQueFecham, MIN_NOTAS_NO_LOTE } from './pagamento-em-lote'

/** dois centavos — a mesma tolerância do endpoint que grava o N:1 */
export const TOLERANCIA = 0.02

/**
 * ⭐ O TETO DA DIFERENÇA QUE FECHA COM NOME (decisão do dono: *"ex. R$ 25"*).
 *
 * ⛔ Acima dele **não há acerto rápido**: *"ou acha a nota, ou baixa parcial, ou não é
 * isso"*. O teto existe pra que "juros" não vire a caixinha onde some qualquer diferença —
 * é o mesmo raciocínio do `diferencaAceita` de 07/09, que só passa se o dono confirmar o
 * número exato que a tela mostrou.
 */
export const TETO_DA_DIFERENCA = 25

export interface NotaAbertaDoCard {
  id: string
  descricao: string
  /** sempre positivo */
  valor: number
  vencimento: Date
  /** ⭐ quanto JÁ foi pago desta nota por baixas parciais anteriores */
  jaPago: number
}

export interface LinhaDoBanco {
  id: string
  descricao: string
  valor: number
  data: Date
  conta: string | null
  categoria: string | null
}

export interface NotaNoCard extends NotaAbertaDoCard {
  /** valor − jaPago: é ELE que entra na conta, não o valor de face */
  emAberto: number
  vencida: boolean
  /** ⭐ marcada pelo atalho? (a tela nasce com estas ligadas) */
  sugerida: boolean
}

export interface CardDeEscolha {
  linha: LinhaDoBanco
  fornecedorId: string
  fornecedorNome: string
  vencidas: NotaNoCard[]
  aVencer: NotaNoCard[]
  /**
   * ⭐ O ATALHO: existe **exatamente uma** combinação que crava o valor da linha.
   * `null` quando não existe nenhuma — ou quando existem duas (aí o sistema não sabe).
   */
  atalho: { notasIds: string[]; resumo: string; ambiguo: boolean } | null
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

/** ⭐ o que a nota ainda deve — o valor de face MENOS o que já foi baixado */
export function emAbertoDaNota(n: { valor: number; jaPago: number }): number {
  return round2(n.valor - n.jaPago)
}

/**
 * ⭐⭐ MONTA O CARD de uma linha do banco contra as notas abertas do fornecedor.
 *
 * ⚠️ A conta usa o **em aberto**, nunca o valor de face: uma nota que já recebeu baixa
 * parcial deve menos, e somar o valor cheio faria o card nunca fechar.
 */
export function montarCardDeEscolha(entrada: {
  linha: LinhaDoBanco
  fornecedorId: string
  fornecedorNome: string
  notas: NotaAbertaDoCard[]
  hoje: Date
}): CardDeEscolha {
  const { linha, notas, hoje } = entrada
  const comAberto = notas
    .map((n) => ({ ...n, emAberto: emAbertoDaNota(n), vencida: n.vencimento < hoje }))
    .filter((n) => n.emAberto > TOLERANCIA)
    .sort((a, b) => a.vencimento.getTime() - b.vencimento.getTime())

  const combos = combinacoesQueFecham(comAberto.map((n) => n.emAberto), linha.valor)
  // ⛔ DUAS combinações que fecham = "não sei qual foi". Sem atalho — a régua do lote.
  const unica = combos.length === 1 ? combos[0] : null
  const ids = unica ? unica.map((i) => comAberto[i].id) : []

  const marcadas = new Set(ids)
  const comSugestao: NotaNoCard[] = comAberto.map((n) => ({ ...n, sugerida: marcadas.has(n.id) }))

  return {
    linha,
    fornecedorId: entrada.fornecedorId,
    fornecedorNome: entrada.fornecedorNome,
    vencidas: comSugestao.filter((n) => n.vencida),
    aVencer: comSugestao.filter((n) => !n.vencida),
    atalho: unica
      ? {
          notasIds: ids,
          resumo: `${ids.length} nota${ids.length > 1 ? 's' : ''} · ${
            unica.map((i) => brl(comAberto[i].emAberto)).join(' + ')}`,
          ambiguo: false,
        }
      : combos.length > 1
        ? { notasIds: [], resumo: `${combos.length}+ combinações fecham neste valor`, ambiguo: true }
        : null,
  }
}

// ────────────────────────────────────────────────────────────────
// A CONTA VIVA DO RODAPÉ
// ────────────────────────────────────────────────────────────────

export type EstadoDoRodape = 'FALTA' | 'FECHA' | 'PASSOU'

export interface ContaDoRodape {
  estado: EstadoDoRodape
  selecionado: number
  diferenca: number
  /** ⛔ a frase que o rodapé imprime */
  frase: string
  /** o Conciliar acende? */
  podeConciliar: boolean
  /** ⭐ a diferença cabe num acerto com NOME (juros/tarifa/desconto)? */
  cabeAcertoComNome: boolean
  /** ⭐ quando a linha é MENOR que o marcado: quem recebe a baixa parcial e de quanto */
  parcial: { notaId: string; recebe: number; continuaEmAberto: number } | null
}

/**
 * ⭐⭐⭐ A CONTA DO RODAPÉ — pura, e é ela que decide se o Conciliar acende.
 *
 * ⛔ `podeConciliar` é FALSO por padrão: só vira verdadeiro com diferença zero, ou com a
 * diferença nomeada (juros/tarifa/desconto dentro do teto), ou com a baixa parcial
 * explicitamente aceita. **Nunca com sobra solta.**
 */
export function contaDoRodape(entrada: {
  valorDaLinha: number
  marcadas: { id: string; emAberto: number }[]
  /** o dono nomeou a diferença? (juros/tarifa/desconto) */
  diferencaNomeada?: boolean
  /** o dono aceitou a baixa parcial na última nota? */
  parcialAceita?: boolean
}): ContaDoRodape {
  const selecionado = round2(entrada.marcadas.reduce((s, m) => s + m.emAberto, 0))
  // ⚠️ diferença = o que FALTA pra fechar a linha. Positiva = falta; negativa = passou.
  const diferenca = round2(entrada.valorDaLinha - selecionado)

  if (Math.abs(diferenca) <= TOLERANCIA) {
    return {
      estado: 'FECHA', selecionado, diferenca: 0,
      frase: '✓ Diferença R$ 0,00',
      podeConciliar: true, cabeAcertoComNome: false, parcial: null,
    }
  }

  if (diferenca > 0) {
    const cabe = diferenca <= TETO_DA_DIFERENCA
    return {
      estado: 'FALTA', selecionado, diferenca,
      frase: `selecionado ${brl(selecionado)} · faltam ${brl(diferenca)}`,
      // ⛔ só acende quando o dono DEU NOME à diferença, e ela cabe no teto
      podeConciliar: cabe && !!entrada.diferencaNomeada,
      cabeAcertoComNome: cabe,
      parcial: null,
    }
  }

  // ⭐ PASSOU: a linha é MENOR que o marcado → a ÚLTIMA nota marcada recebe baixa PARCIAL.
  // ⚠️ "última" = a de vencimento mais distante entre as marcadas; a tela mostra qual é,
  // e o dono desmarca se quiser outra. O sistema não escolhe em silêncio.
  const sobra = round2(-diferenca)
  const ultima = entrada.marcadas[entrada.marcadas.length - 1]
  const parcial = ultima && ultima.emAberto > sobra + TOLERANCIA
    ? {
        notaId: ultima.id,
        recebe: round2(ultima.emAberto - sobra),
        continuaEmAberto: sobra,
      }
    : null

  return {
    estado: 'PASSOU', selecionado, diferenca,
    frase: parcial
      ? `passou ${brl(sobra)} — a última nota recebe baixa parcial`
      : `passou ${brl(sobra)} — desmarca alguma`,
    podeConciliar: !!parcial && !!entrada.parcialAceita,
    cabeAcertoComNome: false,
    parcial,
  }
}

/** ⚠️ o mínimo de notas pra o atalho fazer sentido (1 nota é o caminho 1:1, que já existe) */
export const MIN_NOTAS = MIN_NOTAS_NO_LOTE
