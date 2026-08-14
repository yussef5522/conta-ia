// Sprint Rearquitetura-Import — saldoAntes PURO (13/08). Deriva o saldo ANTES da
// 1ª linha do extrato atual, pra o juiz validar `saldoAntes + Σ(EFETIVADA) ==
// LEDGERBAL`. Módulo ISOLADO, sem DB, sem pipeline, sem RELÓGIO.
//
// FONTE (decisão do Yussef): o LEDGERBAL do import ANTERIOR (o que o BANCO
// declarou), NÃO o balance calculado (que arrasta erro de abertura). Estratégia
// (B) sobreposição, com (A) de rede:
//   - a sobreposição entre o extrato novo e um anterior ancora o saldo por
//     construção (as linhas sobrepostas + o LEDGERBAL anterior dão o ponto);
//   - sem sobreposição (buraco) → avisa o período faltante e ANCORA (não bloqueia);
//   - sobreposição que NÃO bate com o banco → REPORTA (não ancora em cima de
//     dado divergente);
//   - 1º import → ancora.
//
// Casos 5 e 6 (os que mais mordem — extrato fora de ordem/repetido):
//   5) MESMO dia com LEDGERBAL diferente: o download MAIS RECENTE manda (recência
//      = realidade). Prior do mesmo asOf é SUPERSEDED (pula na derivação).
//   6) Extrato ANTIGO importado depois de um novo: `isHistorical=true` — valida a
//      consistência interna, mas NÃO mexe no saldo vivo (segue o mais novo).

const DAY_MS = 86_400_000
const dayStart = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
const daysBetween = (a: Date, b: Date) => Math.round((dayStart(b) - dayStart(a)) / DAY_MS)
const iso = (d: Date) => d.toISOString().slice(0, 10)
const round2 = (n: number) => Math.round(n * 100) / 100
const DEFAULT_TOL = 0.02

export type SaldoAntesOutcome =
  | 'DERIVED_OVERLAP' // sobreposição → derivado (mais confiável)
  | 'DERIVED_CONTIGUOUS' // sem sobreposição mas contíguo (gap <= 1 dia)
  | 'ANCHOR_FIRST_IMPORT' // 1º import
  | 'ANCHOR_GAP' // buraco de extrato → ancora + avisa
  | 'BLOCKED_DIVERGENT' // sobreposição não bate com o banco → reporta

export interface PriorStatement {
  asOf: Date
  ledgerBalance: number
}

export interface SaldoAntesLine {
  date: Date
  signedAmount: number
}

export interface SaldoAntesInput {
  current: {
    periodStart: Date | null
    periodEnd: Date | null
    asOf: Date | null
    ledgerBalance: number | null
    /** Linhas EFETIVADAS do extrato atual. */
    lines: SaldoAntesLine[]
  }
  /** Imports anteriores conhecidos (cada um com o LEDGERBAL que o banco declarou). */
  priorStatements: PriorStatement[]
  /** Tx JÁ no banco na janela do extrato atual (pra checar divergência da
   *  sobreposição). Se vazio, a checagem de divergência é pulada. */
  existingLines: SaldoAntesLine[]
  tolerance?: number
}

export interface SaldoAntesResult {
  outcome: SaldoAntesOutcome
  /** null quando ANCORA (não há saldo anterior confiável). */
  saldoAntes: number | null
  /** false → o juiz ANCORA em vez de validar contra o nada. */
  saldoAntesKnown: boolean
  /** o extrato atual é mais ANTIGO que o mais novo já importado (caso 6) → o
   *  saldo VIVO da conta NÃO deve ser sobrescrito. */
  isHistorical: boolean
  /** há um import do MESMO asOf (caso 5) → ele é superseded pelo atual. */
  supersedesPriorSameDay: boolean
  /** asOf do prior usado na derivação (quando DERIVED). */
  fromPriorAsOf: Date | null
  /** aviso pra tela (buraco, divergência). */
  message: string | null
}

/** Multiset de (data, valor) pra comparar sobreposição. */
function multisetKey(lines: SaldoAntesLine[]): string[] {
  return lines.map((l) => `${iso(l.date)}|${l.signedAmount.toFixed(2)}`).sort()
}
function sameMultiset(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

export function deriveSaldoAntes(input: SaldoAntesInput): SaldoAntesResult {
  const tol = input.tolerance ?? DEFAULT_TOL
  const { current, priorStatements } = input
  const base = {
    saldoAntes: null as number | null,
    saldoAntesKnown: false,
    isHistorical: false,
    supersedesPriorSameDay: false,
    fromPriorAsOf: null as Date | null,
    message: null as string | null,
  }

  // Caso 4 — 1º import (sem anterior). Ancora, não bloqueia.
  if (priorStatements.length === 0) {
    return { ...base, outcome: 'ANCHOR_FIRST_IMPORT' }
  }

  const curAsOf = current.asOf
  const curStart = current.periodStart

  // Caso 6 — o atual é mais ANTIGO que o mais novo já importado (backfill fora de
  // ordem). Marca histórico (o saldo vivo não é do atual) e deriva de um prior
  // anterior ao atual (não do mais novo).
  const newestPriorAsOf = priorStatements.reduce(
    (m, p) => (m === null || p.asOf.getTime() > m.getTime() ? p.asOf : m),
    null as Date | null,
  )
  const isHistorical = !!(curAsOf && newestPriorAsOf && curAsOf.getTime() < newestPriorAsOf.getTime())

  // Caso 5 — priors do MESMO asOf do atual são superseded (o atual é o download
  // mais recente daquele dia). Não entram na derivação.
  const supersedesPriorSameDay =
    !!curAsOf && priorStatements.some((p) => daysBetween(p.asOf, curAsOf) === 0)

  // Seleciona o prior de derivação: o de asOf MAIS TARDIO que seja ESTRITAMENTE
  // anterior ao asOf do atual (pula mesmo-dia = caso 5, e mais-novos = caso 6).
  const refAsOf = curAsOf ?? current.periodEnd
  const candidates = refAsOf
    ? priorStatements.filter((p) => p.asOf.getTime() < dayStart(refAsOf) + DAY_MS && daysBetween(p.asOf, refAsOf) > 0)
    : []
  const prior = candidates.reduce<PriorStatement | null>(
    (m, p) => (m === null || p.asOf.getTime() > m.asOf.getTime() ? p : m),
    null,
  )

  // Sem prior anterior utilizável (só havia mesmo-dia/mais-novos) → ancora + avisa.
  if (!prior) {
    return {
      ...base,
      outcome: 'ANCHOR_FIRST_IMPORT',
      isHistorical,
      supersedesPriorSameDay,
      message: supersedesPriorSameDay
        ? 'Só há extrato(s) do mesmo dia (download repetido) — sem um anterior pra ancorar; usando âncora.'
        : null,
    }
  }

  // Linhas do atual dentro da sobreposição (data <= asOf do prior).
  const overlapLines = current.lines.filter((l) => l.date.getTime() <= dayStart(prior.asOf) + DAY_MS - 1)
  const hasOverlap = overlapLines.length > 0 && !!curStart && daysBetween(curStart, prior.asOf) >= 0

  if (hasOverlap) {
    // Caso 3 — a sobreposição tem que BATER com o que está no banco. Compara
    // multiset (data,valor) das linhas do atual vs as do banco na mesma faixa.
    if (input.existingLines.length > 0) {
      const dbOverlap = input.existingLines.filter(
        (l) =>
          l.date.getTime() <= dayStart(prior.asOf) + DAY_MS - 1 &&
          (!curStart || l.date.getTime() >= dayStart(curStart)),
      )
      if (!sameMultiset(multisetKey(overlapLines), multisetKey(dbOverlap))) {
        return {
          ...base,
          outcome: 'BLOCKED_DIVERGENT',
          isHistorical,
          supersedesPriorSameDay,
          fromPriorAsOf: prior.asOf,
          message:
            'As linhas sobrepostas não batem com o que já está no banco (valor ou data diferente). ' +
            'Não vou ancorar em cima de dado divergente — confira se é a conta certa e o extrato certo.',
        }
      }
    }
    // Caso 1 — deriva: saldoAntes = LEDGERBAL_anterior − Σ(linhas do atual até o asOf anterior).
    const somaOverlap = round2(overlapLines.reduce((s, l) => s + l.signedAmount, 0))
    return {
      ...base,
      outcome: 'DERIVED_OVERLAP',
      saldoAntes: round2(prior.ledgerBalance - somaOverlap),
      saldoAntesKnown: true,
      isHistorical,
      supersedesPriorSameDay,
      fromPriorAsOf: prior.asOf,
    }
  }

  // Sem sobreposição: contíguo (gap <= 1 dia) → saldoAntes = LEDGERBAL anterior.
  const gap = curStart ? daysBetween(prior.asOf, curStart) : Infinity
  if (gap <= 1) {
    return {
      ...base,
      outcome: 'DERIVED_CONTIGUOUS',
      saldoAntes: round2(prior.ledgerBalance),
      saldoAntesKnown: true,
      isHistorical,
      supersedesPriorSameDay,
      fromPriorAsOf: prior.asOf,
    }
  }

  // Caso 2 — BURACO: há período sem extrato entre o anterior e o atual. Ancora +
  // avisa (o buraco é do usuário; ele precisa saber qual intervalo buscar).
  const gapStart = prior.asOf
  const gapEnd = curStart
  return {
    ...base,
    outcome: 'ANCHOR_GAP',
    isHistorical,
    supersedesPriorSameDay,
    fromPriorAsOf: prior.asOf,
    message:
      gapEnd != null
        ? `Há um período SEM extrato entre ${iso(gapStart)} e ${iso(gapEnd)} — baixe o extrato desse intervalo pra validar o saldo. Por ora, ancorando (não bloqueia).`
        : `Há um período sem extrato após ${iso(gapStart)} — ancorando.`,
  }
}

export { DEFAULT_TOL as SALDO_ANTES_TOLERANCE }
