// ⭐⭐⭐ A RÉGUA DA DIFERENÇA TEM UM DONO SÓ (12/09/2026) — ordem do dono.
//
// **O caso que abriu a frente:** OESA, linha **1.695,27** × NF 3866696 de **1.641,12**, os
// **54,15** de multa+juros de atraso (3,3% da linha — dentro do gesto explícito de ontem).
// A tela acendeu o Conciliar e o servidor respondeu:
//
// > *"Soma 1 candidate(s) (R$ 1641.12) não bate com OFX (R$ 1695.27). Diferença: R$ 54.15.
// > Tolerância máxima: R$ 0.02."*
//
// ⛔⛔ **AS RÉGUAS QUE EXISTIAM, e onde cada uma morava:**
//
// | onde | valor | papel |
// |---|---|---|
// | `escolher-na-mao.ts` `TOLERANCIA` | 0,02 | "fecha ao centavo" (card + baixa parcial) |
// | `escolher-na-mao.ts` `TETO_DA_DIFERENCA` | 25 | o que o sistema OFERECE nomeado |
// | `escolher-na-mao.ts` gesto manual | 10% da linha | o que o DONO confirma (ontem) |
// | **`/find-and-match/reconcile` `SUM_TOLERANCE`** | **0,02** | **a régua do SERVIDOR** |
// | `reconcile.ts` `AMOUNT_EQ_TOLERANCE` | 0,01 | bate o `diferencaAceita` ao centavo |
//
// **⚠️⚠️ MAS A CAUSA NÃO ERA A RÉGUA DE 0,02 — era mais simples e pior:** o card **coletava
// o nome da diferença e NUNCA o enviava**. O POST mandava só `candidateIds`, então o
// servidor não tinha como saber que havia uma diferença confirmada. Ele recusava com razão,
// e a tela prometia sem ter como cumprir. ⭐ *A régua de 0,02 é legítima pro que ela mede —
// "a soma fecha?" —; o que faltava era a segunda pergunta: "e se não fecha, o dono nomeou?"*
//
// ⭐ Aqui a régua vira UMA função que o card, o Find & Match, o lote e o SERVIDOR chamam.
// O servidor aceita exatamente o que a tela oferece: **nunca menos, nunca mais.**

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

/** dois centavos — arredondamento bancário, a mesma do `escolher-na-mao` e do servidor */
export const FECHA_AO_CENTAVO = 0.02
/** até aqui o SISTEMA oferece o acerto nomeado sozinho */
export const TETO_QUE_O_SISTEMA_OFERECE = 25
/** ⛔ o teto de segurança do gesto manual — *"ninguém confirma 500 de juros em nota de 600"* */
export const PERCENTUAL_DO_GESTO_MANUAL = 0.10

export type DegrauDaDiferenca =
  /** dentro do arredondamento: fecha direto, sem pergunta nenhuma */
  | 'FECHA'
  /** o sistema oferece o acerto nomeado (≤ R$ 25) */
  | 'OFERECE'
  /** acima do automático e dentro de 10% da linha: o DONO confirma, com o valor à vista */
  | 'PERGUNTA'
  /** acima de 10%: não há acerto rápido — baixa parcial, achar a nota, ou não é isso */
  | 'RECUSA'

export interface VeredictoDaDiferenca {
  degrau: DegrauDaDiferenca
  diferenca: number
  /** até onde o gesto manual alcança NESTA linha */
  tetoDoGesto: number
  /** o Conciliar pode acender? (já considerando se o dono nomeou) */
  podeFechar: boolean
  /** a frase que a tela mostra e que vai GRAVADA no rastro quando ele confirma */
  frase: string
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** ⭐ até onde o dono pode confirmar uma diferença nomeada nesta linha */
export function tetoDoGestoManual(valorDaLinha: number): number {
  return round2(Math.abs(valorDaLinha) * PERCENTUAL_DO_GESTO_MANUAL)
}

/**
 * ⭐⭐ O VEREDICTO, puro — a MESMA função pros quatro chamadores.
 *
 * @param valorDaLinha o valor da linha do extrato
 * @param diferenca    linha − (o que foi marcado). Positiva = falta; negativa = passou.
 * @param nomeada      o dono deu nome à diferença (juros/multa/tarifa/desconto)?
 *
 * ⚠️ O `podeFechar` considera o nome; o `degrau` NÃO — ele descreve o TAMANHO da diferença,
 * e é o mesmo antes e depois de o dono marcar a caixinha. Misturar os dois faria a tela
 * mudar de degrau ao clicar, e o servidor avaliaria um degrau diferente do que a tela mostrou.
 */
export function avaliarDiferenca(
  valorDaLinha: number, diferenca: number, nomeada = false,
): VeredictoDaDiferenca {
  const dif = round2(diferenca)
  const abs = Math.abs(dif)
  const tetoDoGesto = tetoDoGestoManual(valorDaLinha)

  if (abs <= FECHA_AO_CENTAVO) {
    return { degrau: 'FECHA', diferenca: dif, tetoDoGesto, podeFechar: true, frase: '✓ Diferença R$ 0,00' }
  }
  if (abs <= TETO_QUE_O_SISTEMA_OFERECE) {
    return {
      degrau: 'OFERECE', diferenca: dif, tetoDoGesto, podeFechar: nomeada,
      frase: `diferença de ${brl(abs)} — dá pra fechar como juros/tarifa`,
    }
  }
  if (abs <= tetoDoGesto) {
    return {
      degrau: 'PERGUNTA', diferenca: dif, tetoDoGesto, podeFechar: nomeada,
      // ⭐ a frase do dono, com o número dele dentro — é ela que vai pro rastro
      frase: `a diferença de ${brl(abs)} é juros/multa de atraso — confirmar`,
    }
  }
  return {
    degrau: 'RECUSA', diferenca: dif, tetoDoGesto, podeFechar: false,
    frase: `diferença de ${brl(abs)}, acima do teto de segurança (${brl(tetoDoGesto)}) — `
      + 'ou falta uma nota, ou é baixa parcial, ou não é isso',
  }
}

/**
 * ⛔⛔ O QUE O SERVIDOR CHECA — e é o MESMO veredicto, com uma trava a mais.
 *
 * A diferença que o cliente manda tem que **bater ao centavo** com a real: é o que separa
 * *"vi e aceito os R$ 54,15 de juros"* de *"ignora a trava"*. É a régua do Cancian (07/09),
 * agora valendo também no caminho N:1.
 */
export function servidorAceitaADiferenca(entrada: {
  valorDaLinha: number
  somaMarcada: number
  /** o número que a TELA mostrou e o dono confirmou — `undefined` = ele não nomeou nada */
  diferencaConfirmada?: number
}): { ok: true; veredicto: VeredictoDaDiferenca } | { ok: false; erro: string } {
  const diferencaReal = round2(entrada.valorDaLinha - entrada.somaMarcada)
  const nomeada = entrada.diferencaConfirmada !== undefined
    && Math.abs(round2(entrada.diferencaConfirmada) - diferencaReal) <= 0.01
  const v = avaliarDiferenca(entrada.valorDaLinha, diferencaReal, nomeada)

  if (v.degrau === 'FECHA') return { ok: true, veredicto: v }
  if (v.degrau === 'RECUSA') return { ok: false, erro: v.frase }
  if (!nomeada) {
    return {
      ok: false,
      // ⚠️ a mensagem diz o que FAZER. "Tolerância máxima: R$ 0,02" mandava o dono procurar
      // um erro que não existia — a diferença era juros, e ele sabia disso.
      erro: entrada.diferencaConfirmada === undefined
        ? `Diferença de ${brl(Math.abs(diferencaReal))} — confirme na tela que é juros/multa pra conciliar`
        : `A diferença confirmada (${brl(Math.abs(entrada.diferencaConfirmada))}) não bate com a real (${brl(Math.abs(diferencaReal))})`,
    }
  }
  return { ok: true, veredicto: v }
}
