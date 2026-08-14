// Sprint Wiring-do-Juiz (14/08) — CHOKE-POINT de classificação do import.
//
// PROBLEMA que fecha: a heurística FITID==YYMMDD vivia em 2 cópias (future-line e
// reconcile.isPreviewLine) e decidia status por FORMATO de identificador — o bug
// que descartou a parcela paga 4.092,02. A decisão de status passa a ser UMA só,
// pelo LEDGERBAL (o juiz), e ela roda IGUAL no preview e no confirm (se a tela
// mostrar uma coisa e gravar outra é pior que não ter juiz).
//
// CADEIA (o que o shadow provou): o saldoAntes do extrato atual vem do import
// ANTERIOR, mas `prior.lines` tem que ser o conjunto PÓS-JUIZ (o que entrou no
// LEDGERBAL dele) — senão o extrato seguinte re-subtrai a linha que o juiz anterior
// deferiu (ex o consórcio -1.478,51 do 11/08 dobrava no 13/08). Por isso re-julgamos
// os anteriores em ordem cronológica, encadeando os efetivados de cada um.
//
// ZERO relógio: tudo vem do ARQUIVO (canônico) + do LEDGERBAL. O `dtServer` (=
// createdAt do OfxImport) só desempata downloads do MESMO dia.

import { deriveSaldoAntes, type PriorStatement, type SaldoAntesLine, type SaldoAntesResult } from './saldo-antes'
import { judgeStatement, type JudgeResult } from './judge'
import type { CanonicalStatement } from './types'

export interface PriorCanonical {
  canonical: CanonicalStatement
  /** createdAt do OfxImport — desempata downloads do mesmo asOf. */
  dtServer: Date
}

export interface ClassifyInput {
  current: CanonicalStatement
  currentDtServer: Date
  /** TODOS os imports anteriores com blob (qualquer ordem; a cadeia ordena). */
  priors: PriorCanonical[]
  /** tx já no DB na janela do atual — pra a checagem de divergência do saldoAntes. */
  existingLines?: SaldoAntesLine[]
  /** false = banco cujo LEDGERBAL não fecha por design (Stone varre) → juiz avisa, não bloqueia. */
  ledgerBalReliable?: boolean
  tolerance?: number
}

export interface ClassifyResult {
  /** Por transação do `current` (MESMA ordem): true = IMPORTA (efetivada pós-juiz),
   *  false = NÃO importa (agendada/não-liquidada). É o que o pipeline consome. */
  importable: boolean[]
  effectedIds: string[]
  judge: JudgeResult
  saldoAntes: SaldoAntesResult
  /** true = o juiz NÃO fecha e nada explica → NÃO grava, mostra na tela (nunca em
   *  silêncio). NO_LEDGER (arquivo sem saldo) NÃO bloqueia — degrada pro canônico. */
  blocked: boolean
  message: string | null
}

const linesOf = (c: CanonicalStatement): SaldoAntesLine[] =>
  c.transactions.map((t) => ({ date: t.datePosted, signedAmount: t.signedAmount }))

/**
 * Re-julga os extratos anteriores em ordem cronológica, encadeando os efetivados
 * (PÓS-JUIZ) de cada um como `prior.lines` do próximo. Devolve os PriorStatement
 * prontos pra o saldoAntes do extrato atual. PURO (sem DB, sem relógio).
 */
export function chainPriorStatements(
  priors: PriorCanonical[],
  opts?: { ledgerBalReliable?: boolean; tolerance?: number },
): PriorStatement[] {
  const sorted = priors
    .filter((p) => p.canonical.ledger.asOf)
    .sort((a, b) => {
      const da = a.canonical.ledger.asOf!.getTime()
      const db = b.canonical.ledger.asOf!.getTime()
      return da !== db ? da - db : a.dtServer.getTime() - b.dtServer.getTime()
    })

  const processed: PriorStatement[] = []
  for (const p of sorted) {
    const c = p.canonical
    const derive = deriveSaldoAntes({
      current: {
        periodStart: c.period.start,
        periodEnd: c.period.end,
        asOf: c.ledger.asOf,
        dtServer: p.dtServer,
        ledgerBalance: c.ledger.balance,
        lines: linesOf(c),
      },
      priorStatements: processed,
      existingLines: [],
      tolerance: opts?.tolerance,
    })
    const judge = judgeStatement({
      canonical: c,
      saldoAntes: derive.saldoAntes ?? 0,
      saldoAntesKnown: derive.saldoAntesKnown,
      ledgerBalReliable: opts?.ledgerBalReliable,
      knownScheduled: derive.persistentUnsettled.map((x) => ({ date: x.date, signedAmount: x.signedAmount })),
      tolerance: opts?.tolerance,
    })
    // prior.lines = conjunto LIQUIDADO. Se o juiz fechou, os effectedIds; se NÃO
    // fechou (bloqueio/dado inconsistente), cai no canônico EFETIVADA (best-effort)
    // — a LEDGERBAL do banco (sempre confiável como número) segue ancorando.
    const effSet = new Set(judge.effectedIds)
    const settled = judge.closes
      ? c.transactions.filter((t) => effSet.has(t.stableId))
      : c.transactions.filter((t) => t.status === 'EFETIVADA')
    processed.push({
      asOf: c.ledger.asOf!,
      ledgerBalance: c.ledger.balance ?? 0,
      dtServer: p.dtServer,
      lines: settled.map((t) => ({ date: t.datePosted, signedAmount: t.signedAmount })),
    })
  }
  return processed
}

/**
 * A decisão ÚNICA de import: canônico → saldoAntes (cadeia) → juiz. Devolve o que
 * importa por linha. Chamada IGUAL no preview e no confirm.
 */
export function classifyCanonicalForImport(input: ClassifyInput): ClassifyResult {
  const c = input.current
  const processed = chainPriorStatements(input.priors, {
    ledgerBalReliable: input.ledgerBalReliable,
    tolerance: input.tolerance,
  })
  const saldoAntes = deriveSaldoAntes({
    current: {
      periodStart: c.period.start,
      periodEnd: c.period.end,
      asOf: c.ledger.asOf,
      dtServer: input.currentDtServer,
      ledgerBalance: c.ledger.balance,
      lines: linesOf(c),
    },
    priorStatements: processed,
    existingLines: input.existingLines ?? [],
    tolerance: input.tolerance,
  })
  const judge = judgeStatement({
    canonical: c,
    saldoAntes: saldoAntes.saldoAntes ?? 0,
    saldoAntesKnown: saldoAntes.saldoAntesKnown,
    ledgerBalReliable: input.ledgerBalReliable,
    knownScheduled: saldoAntes.persistentUnsettled.map((x) => ({ date: x.date, signedAmount: x.signedAmount })),
    tolerance: input.tolerance,
  })

  const effSet = new Set(judge.effectedIds)
  const importable = c.transactions.map((t) => effSet.has(t.stableId))
  // NO_LEDGER (arquivo sem saldo) → não dá pra julgar, mas NÃO bloqueia: degrada
  // pro canônico (date-based), que já veio nos effectedIds do juiz nesse outcome.
  const blocked = !judge.closes && judge.outcome !== 'NO_LEDGER'

  return {
    importable,
    effectedIds: judge.effectedIds,
    judge,
    saldoAntes,
    blocked,
    message: blocked ? (judge.outcome === 'BLOCKED_AMBIGUOUS'
      ? `O saldo do banco (${judge.ledgerBalance}) não fecha e há mais de uma explicação possível — não vou gravar no chute. Confira o extrato.`
      : `O saldo do banco (${judge.ledgerBalance}) não fecha com as transações (diferença ${judge.gap}) e não encontrei explicação${judge.searchMayHaveMissed ? ' entre as que consigo testar' : ''}. Não vou gravar em silêncio — confira se é a conta e o extrato certos.`)
      : saldoAntes.message,
  }
}
