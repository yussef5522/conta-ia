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
export { FECHA_AO_CENTAVO as TOLERANCIA } from './regua-da-diferenca'
import { FECHA_AO_CENTAVO as TOLERANCIA, TETO_QUE_O_SISTEMA_OFERECE, tetoDoGestoManual as tetoDoGesto, avaliarDiferenca } from './regua-da-diferenca'

/**
 * ⭐ O TETO DA DIFERENÇA QUE FECHA COM NOME (decisão do dono: *"ex. R$ 25"*).
 *
 * ⛔ Acima dele **não há acerto rápido**: *"ou acha a nota, ou baixa parcial, ou não é
 * isso"*. O teto existe pra que "juros" não vire a caixinha onde some qualquer diferença —
 * é o mesmo raciocínio do `diferencaAceita` de 07/09, que só passa se o dono confirmar o
 * número exato que a tela mostrou.
 */
export const TETO_DA_DIFERENCA = TETO_QUE_O_SISTEMA_OFERECE

/**
 * ⭐⭐⭐ O TETO DO GESTO MANUAL (11/09/2026) — decisão do dono.
 *
 * **Ele:** *"O teto de R$ 25 vale pro que o sistema SUGERE sozinho; acima dele, aparece o
 * gesto explícito: 'a diferença de R$ 45,60 é juros/multa de atraso — confirmar'. Teto de
 * segurança maior pro gesto manual (ex. 10% da linha) pra ninguém 'confirmar' 500 de juros
 * em nota de 600 sem querer."*
 *
 * **O caso real:** Frigorífico, linha **3.845,71** × NF parcela 001 de **3.800,11** paga
 * atrasada — os **R$ 45,60** SÃO multa+juros, e o teto de 25 os deixava sem saída.
 *
 * ⛔ São DOIS tetos com papéis diferentes, e é isso que impede "juros" de virar a caixinha
 * onde some qualquer diferença: até 25 o sistema **oferece** o acerto; entre 25 e 10% da
 * linha ele **pergunta, com o valor em destaque**; acima de 10% **não há acerto rápido** —
 * ou acha a nota, ou baixa parcial, ou não é isso.
 */
/** ⚠️ os NÚMEROS moram em `regua-da-diferenca.ts` desde 12/09 — aqui só reexportamos, pra
 *  quem já importava daqui continuar funcionando sem criar uma segunda régua. */
export { PERCENTUAL_DO_GESTO_MANUAL as PERCENTUAL_MAXIMO_DO_GESTO_MANUAL, tetoDoGestoManual } from './regua-da-diferenca'

/**
 * ⭐ A JANELA DO "A VENCER" — quantos dias à frente abrem na tela (decisão do dono: *"só
 * notas até ~30 dias, com 'mostrar mais' pro resto"*).
 */
export const JANELA_A_VENCER_DIAS = 30

/**
 * ⚠️ E o PISO: se a janela não deixar NENHUMA a vencer visível, as 3 mais próximas abrem
 * assim mesmo. Seção vazia com um "mostrar mais" ao lado esconde o caminho de fechar a
 * conta — e é justamente o caso do fornecedor cujas parcelas são todas trimestrais.
 */
export const MINIMO_A_VENCER_VISIVEL = 3

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
  /** ⭐ a tela nasce com estas ligadas (o atalho, ou as vencidas — ver `marcadasDeSaida`) */
  sugerida: boolean
  /**
   * ⭐ A JANELA: nota a vencer LONGE fica escondida atrás de "mostrar mais".
   *
   * ⛔ O dono, vendo a Box Paper: *"R02 R03 R04 R05 até 09/11 é ruído — pagamento de 02/09
   * não quita parcela de novembro"*. Ela **continua na lista** (esconder de vez faria o
   * card nunca fechar no dia em que ele adiantar uma parcela) — só não abre a tela.
   */
  foraDaJanela: boolean
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

  /**
   * ⭐⭐ O QUE NASCE MARCADO — decisão do dono: *"vencidas já vêm marcadas; o caso comum é
   * o pagamento cobrir as vencidas, eu desmarco a exceção"*.
   *
   * ⛔⛔ MAS A AMBIGUIDADE CONTINUA MARCANDO NADA. Quando duas combinações fecham, a tela
   * diz por escrito *"o sistema não sabe qual foi, então não marca nada"* — pré-marcar ali
   * quebraria uma promessa impressa na tela, que é pior que a falta do atalho.
   *
   * ⚠️ E marcar É SUGERIR, nunca decidir: o Conciliar continua acendendo só com a conta
   * fechada (ou a diferença nomeada dentro do teto, ou a parcial aceita).
   */
  const marcadas = new Set(
    unica ? ids
      : combos.length > 1 ? []
        : comAberto.filter((n) => n.vencida).map((n) => n.id),
  )

  const limite = new Date(hoje.getTime() + JANELA_A_VENCER_DIAS * 86_400_000)
  const aVencerOrdenadas = comAberto.filter((n) => !n.vencida)
  // ⚠️ O PISO SÓ VALE QUANDO A JANELA DEIXOU A SEÇÃO VAZIA. Aplicá-lo sempre faria as 3
  // mais próximas abrirem mesmo estando em novembro — que é justamente o ruído reclamado.
  const pisoDaJanela = new Set(
    aVencerOrdenadas.some((n) => n.vencimento <= limite)
      ? []
      : aVencerOrdenadas.slice(0, MINIMO_A_VENCER_VISIVEL).map((n) => n.id),
  )

  const comSugestao: NotaNoCard[] = comAberto.map((n) => ({
    ...n,
    sugerida: marcadas.has(n.id),
    // ⚠️ vencida nunca sai da janela — ela é o trabalho, não o ruído.
    foraDaJanela: !n.vencida && n.vencimento > limite && !pisoDaJanela.has(n.id),
  }))

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
  /** ⭐ a diferença cabe num acerto com NOME que o SISTEMA oferece (≤ R$ 25)? */
  cabeAcertoComNome: boolean
  /**
   * ⭐⭐ acima do teto automático, mas dentro do teto de segurança: o dono PODE confirmar,
   * com o valor em destaque. `null` quando não se aplica (cabe no automático, ou passou de
   * 10% da linha). Ver `tetoDoGestoManual`.
   */
  acertoQueEuConfirmo: { diferenca: number; teto: number; frase: string } | null
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
      podeConciliar: true, cabeAcertoComNome: false, acertoQueEuConfirmo: null, parcial: null,
    }
  }

  if (diferenca > 0) {
    const cabe = diferenca <= TETO_DA_DIFERENCA
    // ⭐⭐ entre o teto automático e 10% da linha: o gesto existe, mas é DELE (11/09)
    const teto = tetoDoGesto(entrada.valorDaLinha)
    const cabeNoManual = !cabe && diferenca <= teto
    return {
      estado: 'FALTA', selecionado, diferenca,
      frase: `selecionado ${brl(selecionado)} · faltam ${brl(diferenca)}`,
      // ⛔ só acende quando o dono DEU NOME à diferença — e ela cabe num dos dois tetos
      podeConciliar: (cabe || cabeNoManual) && !!entrada.diferencaNomeada,
      cabeAcertoComNome: cabe,
      acertoQueEuConfirmo: cabeNoManual
        ? {
            diferenca, teto,
            // ⚠️ a frase NOMEIA a diferença e mostra o número — é o que o dono confirma,
            // e é o que fica escrito no rastro ("confirmada por quem conciliou").
            frase: `a diferença de ${brl(diferenca)} é juros/multa de atraso — confirmar`,
          }
        : null,
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
    cabeAcertoComNome: false, acertoQueEuConfirmo: null,
    parcial,
  }
}

/** ⚠️ o mínimo de notas pra o atalho fazer sentido (1 nota é o caminho 1:1, que já existe) */
export const MIN_NOTAS = MIN_NOTAS_NO_LOTE
