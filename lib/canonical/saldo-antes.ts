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
  /** DTSERVER do OFX — desempata downloads do MESMO asOf (caso 5). Null = mais antigo. */
  dtServer?: Date | null
  /**
   * (A) 14/08 — as linhas do extrato ANTERIOR (as que o banco listou nele). Permite
   * a regra GERAL de não-liquidada persistente: uma linha do overlap ATUAL que NÃO
   * estava no extrato anterior nunca entrou naquele LEDGERBAL → ainda não liquidou
   * (o banco lista/re-lista mas não debitou — ex: parcela vencida sem saldo),
   * INDEPENDENTE da data. Sem isto, a derivação subtraía essa linha como se tivesse
   * liquidado e o saldoAntes saía errado. Ausente → fallback (subtrai todo o overlap).
   */
  lines?: SaldoAntesLine[]
}

export interface SaldoAntesLine {
  date: Date
  signedAmount: number
}

/**
 * (A) 14/08 — linha do overlap atual que NÃO estava no extrato anterior e nunca
 * entrou num LEDGERBAL → NÃO-LIQUIDADA. Regra geral (não é específica de empréstimo):
 * o banco listou de novo mas não debitou. NÃO entra no Σ do saldoAntes; o juiz a
 * trata como AGENDADA e confirma via LEDGERBAL. A MENSAGEM na tela (agendada futura
 * vs vencida-em-atraso) é do caller — ele compara a data com HOJE (aqui é sem relógio).
 */
export interface PersistentUnsettledLine {
  date: Date
  signedAmount: number
  /** asOf do extrato anterior que JÁ não a listava — "aparece desde depois disto". */
  sinceAsOf: Date
}

export interface SaldoAntesInput {
  current: {
    periodStart: Date | null
    periodEnd: Date | null
    asOf: Date | null
    ledgerBalance: number | null
    /** DTSERVER do OFX atual — desempata mesmo dia. */
    dtServer?: Date | null
    /** Linhas EFETIVADAS do extrato atual. */
    lines: SaldoAntesLine[]
  }
  /** Imports anteriores conhecidos (cada um com o LEDGERBAL que o banco declarou). */
  priorStatements: PriorStatement[]
  /** Tx JÁ no banco na janela do extrato atual (pra checar divergência da
   *  sobreposição). Se vazio, a checagem de divergência é pulada. */
  existingLines: SaldoAntesLine[]
  /** ESCAPE (caso 3, decisão do Yussef): o usuário olhou e disse "é o banco que
   *  reemitiu, pode seguir" → destrava a divergência (registrado como forçado).
   *  Bloqueio sem saída vira paralisia. */
  overrideDivergent?: boolean
  tolerance?: number
}

export interface SaldoAntesResult {
  outcome: SaldoAntesOutcome
  /** null quando ANCORA (não há saldo anterior confiável). */
  saldoAntes: number | null
  /** false → o juiz ANCORA em vez de validar contra o nada. */
  saldoAntesKnown: boolean
  /** ⚠️ O FLAG QUE O PIPELINE USA: false = este extrato NÃO é o snapshot mais
   *  recente (mais antigo por período OU download mais velho do mesmo dia) → o
   *  saldo VIVO da conta NÃO pode ser sobrescrito. "O mais antigo não desfaz o
   *  mais novo" (casos 5 e 6). */
  shouldUpdateLiveBalance: boolean
  /** o extrato atual é mais ANTIGO que o mais novo já importado (caso 6). */
  isHistorical: boolean
  /** há um import do MESMO asOf (caso 5) — o mais recente (por DTSERVER) manda. */
  supersedesPriorSameDay: boolean
  /** true = seguiu APESAR da divergência da sobreposição (escape do usuário). */
  forcedOverDivergence: boolean
  /** asOf do prior usado na derivação (quando DERIVED). */
  fromPriorAsOf: Date | null
  /** (A) 14/08 — linhas do overlap que o extrato anterior NÃO tinha e que nunca
   *  entraram num LEDGERBAL → não-liquidadas. O juiz deve tratá-las como AGENDADA.
   *  Vazio quando o prior não trouxe `lines` (fallback) ou quando tudo bate. */
  persistentUnsettled: PersistentUnsettledLine[]
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

const ms = (d: Date | null | undefined) => (d ? d.getTime() : -Infinity)

/**
 * (A) — separa o overlap atual em (i) linhas que ESTAVAM no extrato anterior
 * (liquidaram, entram no Σ) e (ii) linhas que NÃO estavam (persistentes-não-liquidadas,
 * ficam de fora e viram AGENDADA). Casamento por multiset (data|valor), consumindo
 * cada linha do anterior 1×. Sem `priorLines` → tudo conta como matched (fallback).
 */
function partitionOverlapByPrior(
  overlap: SaldoAntesLine[],
  priorLines: SaldoAntesLine[] | undefined,
): { matched: SaldoAntesLine[]; unmatched: SaldoAntesLine[] } {
  if (!priorLines) return { matched: overlap, unmatched: [] }
  const counts = new Map<string, number>()
  for (const l of priorLines) {
    const k = `${iso(l.date)}|${l.signedAmount.toFixed(2)}`
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  const matched: SaldoAntesLine[] = []
  const unmatched: SaldoAntesLine[] = []
  for (const l of overlap) {
    const k = `${iso(l.date)}|${l.signedAmount.toFixed(2)}`
    const n = counts.get(k) ?? 0
    if (n > 0) {
      counts.set(k, n - 1)
      matched.push(l)
    } else {
      unmatched.push(l)
    }
  }
  return { matched, unmatched }
}

/** a é MAIS RECENTE que b? Por asOf (dia); empate por DTSERVER (download). */
function moreRecent(
  a: { asOf: Date | null; dtServer?: Date | null },
  b: { asOf: Date | null; dtServer?: Date | null },
): boolean {
  const da = a.asOf ? dayStart(a.asOf) : -Infinity
  const db = b.asOf ? dayStart(b.asOf) : -Infinity
  if (da !== db) return da > db
  return ms(a.dtServer) > ms(b.dtServer)
}

export function deriveSaldoAntes(input: SaldoAntesInput): SaldoAntesResult {
  void (input.tolerance ?? DEFAULT_TOL)
  const { current, priorStatements } = input
  const curAsOf = current.asOf
  const curStart = current.periodStart

  // Caso 6 — o atual é mais ANTIGO que o mais novo já importado (backfill fora de
  // ordem). Deriva de um prior anterior, NÃO do mais novo.
  const newestPriorAsOf = priorStatements.reduce(
    (m, p) => (m === null || p.asOf.getTime() > m.getTime() ? p.asOf : m),
    null as Date | null,
  )
  const isHistorical = !!(curAsOf && newestPriorAsOf && curAsOf.getTime() < newestPriorAsOf.getTime())

  // Caso 5 — há prior do MESMO dia (download repetido). O mais recente (por
  // DTSERVER) manda.
  const supersedesPriorSameDay =
    !!curAsOf && priorStatements.some((p) => daysBetween(p.asOf, curAsOf) === 0)

  // ⚠️ "O mais antigo NÃO desfaz o mais novo" (casos 5 e 6): o saldo VIVO só é
  // sobrescrito se o extrato atual é o snapshot MAIS RECENTE (nenhum prior é mais
  // recente que ele — por asOf, empate por DTSERVER). Subir o de manhã depois do
  // de tarde NÃO faz o saldo voltar.
  const anyPriorMoreRecent = priorStatements.some((p) => moreRecent(p, current))
  const shouldUpdateLiveBalance = !anyPriorMoreRecent

  const base = {
    saldoAntes: null as number | null,
    saldoAntesKnown: false,
    shouldUpdateLiveBalance,
    isHistorical,
    supersedesPriorSameDay,
    forcedOverDivergence: false,
    fromPriorAsOf: null as Date | null,
    persistentUnsettled: [] as PersistentUnsettledLine[],
    message: null as string | null,
  }

  // Caso 4 — 1º import (sem anterior). Ancora, não bloqueia.
  if (priorStatements.length === 0) {
    return { ...base, outcome: 'ANCHOR_FIRST_IMPORT' }
  }

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
      message: supersedesPriorSameDay
        ? 'Só há extrato(s) do mesmo dia (download repetido) — sem um anterior pra ancorar; usando âncora.'
        : null,
    }
  }

  // Linhas do atual dentro da sobreposição (data <= asOf do prior).
  const overlapLines = current.lines.filter((l) => l.date.getTime() <= dayStart(prior.asOf) + DAY_MS - 1)
  const hasOverlap = overlapLines.length > 0 && !!curStart && daysBetween(curStart, prior.asOf) >= 0

  if (hasOverlap) {
    // (A) 14/08 — separa o overlap ANTES da checagem de divergência: só as linhas que
    // o extrato anterior LISTAVA entraram no LEDGERBAL dele; as que ele NÃO tinha
    // (persistente-não-liquidada, ex: parcela vencida sem saldo) NÃO liquidaram → ficam
    // FORA do Σ e são reportadas pro juiz tratar como AGENDADA. Sem prior.lines →
    // matched = todo o overlap (fallback do comportamento antigo).
    const { matched, unmatched } = partitionOverlapByPrior(overlapLines, prior.lines)
    const persistentUnsettled: PersistentUnsettledLine[] = unmatched.map((l) => ({
      date: l.date,
      signedAmount: l.signedAmount,
      sinceAsOf: prior.asOf,
    }))

    // Caso 3 — a sobreposição LIQUIDADA (matched) tem que BATER com o que está no banco
    // (multiset data,valor). Diverge → BLOQUEIA, a menos que o usuário destrave.
    // ⚠️ compara só `matched` (não o overlap todo): a linha persistente-não-liquidada
    // legitimamente ainda NÃO está no DB — não é sinal de conta/extrato errado.
    let divergent = false
    if (input.existingLines.length > 0) {
      const dbOverlap = input.existingLines.filter(
        (l) =>
          l.date.getTime() <= dayStart(prior.asOf) + DAY_MS - 1 &&
          (!curStart || l.date.getTime() >= dayStart(curStart)),
      )
      divergent = !sameMultiset(multisetKey(matched), multisetKey(dbOverlap))
    }
    if (divergent && !input.overrideDivergent) {
      return {
        ...base,
        outcome: 'BLOCKED_DIVERGENT',
        fromPriorAsOf: prior.asOf,
        persistentUnsettled,
        message:
          'As linhas sobrepostas não batem com o que já está no banco (valor ou data diferente). ' +
          'Não vou ancorar em cima de dado divergente — confira se é a conta certa e o extrato certo. ' +
          'Se for o banco que reemitiu, você pode destravar (segue registrado como forçado).',
      }
    }
    // Caso 1 — deriva: saldoAntes = LEDGERBAL_anterior − Σ(matched).
    const somaOverlap = round2(matched.reduce((s, l) => s + l.signedAmount, 0))
    const persistMsg =
      persistentUnsettled.length > 0
        ? `${persistentUnsettled.length} linha(s) aparecem no extrato mas não estavam no anterior (${iso(prior.asOf)}) e nunca entraram no saldo declarado — o banco listou mas ainda NÃO debitou (ex: parcela vencida sem saldo). Tratando como agendada/não-liquidada.`
        : null
    return {
      ...base,
      outcome: 'DERIVED_OVERLAP',
      saldoAntes: round2(prior.ledgerBalance - somaOverlap),
      saldoAntesKnown: true,
      forcedOverDivergence: divergent, // true = seguiu APESAR da divergência (escape do usuário)
      fromPriorAsOf: prior.asOf,
      persistentUnsettled,
      message: divergent
        ? 'Sobreposição divergente — seguiu por decisão sua (registrado como forçado).'
        : persistMsg,
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
    fromPriorAsOf: prior.asOf,
    message:
      gapEnd != null
        ? `Há um período SEM extrato entre ${iso(gapStart)} e ${iso(gapEnd)} — baixe o extrato desse intervalo pra validar o saldo. Por ora, ancorando (não bloqueia).`
        : `Há um período sem extrato após ${iso(gapStart)} — ancorando.`,
  }
}

export { DEFAULT_TOL as SALDO_ANTES_TOLERANCE }
