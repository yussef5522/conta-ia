// Sprint Rearquitetura-Import FASE 3 (13/08) — O JUIZ (Camada 2).
//
// REGRA SUPREMA (decisão de produto): o LEDGERBAL é o juiz. Se a soma das
// EFETIVADAS + saldo anterior não fecha com o saldo que o banco declara, o
// sistema NÃO GRAVA em silêncio. Tenta EXPLICAR reclassificando NOS DOIS
// SENTIDOS; se fecha, aplica e mostra o que mudou e por quê; se nada fecha,
// devolve BLOCKED com a diferença e as candidatas pra o usuário decidir.
//
// Isto é o que faltava: a Camada 2 antiga só empurrava pra FORA (linha que não
// liquidou). Agora também traz de VOLTA (linha descartada que o LEDGERBAL prova
// que liquidou — o caso do emprestimo 4.092,02 de 13/08).
//
// DESCONHECIDA: nunca grava em silêncio. Entra como candidata a virar EFETIVADA
// SÓ se o LEDGERBAL fechar com ela dentro; senão fica de fora e vai pra tela.

import type { CanonicalStatement, CanonicalStatus } from './types'

const DEFAULT_TOL = 0.02
const POWERSET_MAX = 18 // 2^18 ≈ 262k — acima disso, busca limitada (avisa)

export type JudgeOutcome =
  | 'CLOSED' // fechou de primeira
  | 'CLOSED_AFTER_RECLASS' // fechou após reclassificar (com registro)
  | 'CLOSED_BY_OPENING_ANCHOR' // 1º import (sem saldo anterior) → ancora, não valida
  | 'WARN_UNRELIABLE_LEDGER' // banco cujo LEDGERBAL não fecha por design (Stone varre) → grava avisando
  | 'BLOCKED_NO_EXPLANATION' // não fecha e nada explica
  | 'BLOCKED_AMBIGUOUS' // 2+ explicações fecham — não chuta
  | 'NO_LEDGER' // arquivo sem LEDGERBAL — não dá pra julgar

export interface Reclassification {
  stableId: string
  from: CanonicalStatus
  to: CanonicalStatus
  signedAmount: number
  reason: string
}

export interface JudgeCandidate {
  stableId: string
  status: CanonicalStatus
  signedAmount: number
  description: string
}

export interface JudgeResult {
  outcome: JudgeOutcome
  /** true só em CLOSED / CLOSED_AFTER_RECLASS. Só grava quando true. */
  closes: boolean
  ledgerBalance: number | null
  saldoAntes: number
  expectedBefore: number // saldoAntes + Σ(EFETIVADA original)
  expectedAfter: number // após reclassificação
  gap: number // ledger - expectedBefore
  reclassifications: Reclassification[]
  /** stableIds que DEVEM virar transação efetivada (o que grava). */
  effectedIds: string[]
  /** quando BLOCKED: o que o juiz considerou, pra mostrar na tela. */
  candidates: JudgeCandidate[]
  /** true quando a busca foi LIMITADA (muitos flippáveis) E não achou explicação:
   *  pode existir uma que não testei. O aviso na tela tem que dizer isso — não é
   *  "não há explicação", é "não encontrei entre as que consigo testar". */
  searchMayHaveMissed: boolean
  /** resumo pro contexto do rawOfxBlob (finalizeOfxImport). */
  summary: {
    reclassUpToEffected: number
    reclassDownToScheduled: number
    boundedSearch: boolean
    flippableCount: number
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Todos os subconjuntos de tamanho MÍNIMO cuja soma de deltas ≈ target. */
function minimalSolvingSubsets(
  deltas: number[],
  target: number,
  tol: number,
): { solutions: number[][]; bounded: boolean } {
  const n = deltas.length
  const solutions: number[][] = []
  const bounded = n > POWERSET_MAX

  const consider = (idx: number[]) => {
    const sum = idx.reduce((s, i) => s + deltas[i], 0)
    if (Math.abs(sum - target) <= tol) solutions.push(idx)
  }

  if (!bounded) {
    // powerset completo (1..2^n-1), ordenado por tamanho pra achar o mínimo
    for (let mask = 1; mask < 1 << n; mask++) {
      const idx: number[] = []
      for (let i = 0; i < n; i++) if (mask & (1 << i)) idx.push(i)
      consider(idx)
    }
  } else {
    // busca LIMITADA (avisada): tamanhos 1..3 só. Nunca silenciosa (bounded=true).
    for (let i = 0; i < n; i++) consider([i])
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) consider([i, j])
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++)
        for (let k = j + 1; k < n; k++) consider([i, j, k])
  }

  if (solutions.length === 0) return { solutions: [], bounded }
  const minSize = Math.min(...solutions.map((s) => s.length))
  return { solutions: solutions.filter((s) => s.length === minSize), bounded }
}

export interface JudgeInput {
  canonical: CanonicalStatement
  /** Saldo da conta ANTES deste import. FONTE: o LEDGERBAL do IMPORT ANTERIOR
   *  (o que o BANCO declarou), NÃO o balance calculado (que arrasta erro histórico
   *  de abertura não modelada). Confirmado pelo Yussef. */
  saldoAntes: number
  /** false = 1º import (não há LEDGERBAL anterior) → o juiz ANCORA (define a
   *  abertura) em vez de bloquear. Ninguém valida contra o nada. */
  saldoAntesKnown?: boolean
  /** false = banco cujo LEDGERBAL não fecha por design (Stone varre o saldo
   *  intradiário) → não bloqueia, GRAVA avisando (WARN_UNRELIABLE_LEDGER). */
  ledgerBalReliable?: boolean
  tolerance?: number
}

/**
 * O juiz. Decide o que grava validando contra o LEDGERBAL, reclassificando nos
 * dois sentidos até fechar. NUNCA grava em silêncio quando não fecha.
 */
export function judgeStatement(input: JudgeInput): JudgeResult {
  const tol = input.tolerance ?? DEFAULT_TOL
  const { transactions, ledger } = input.canonical
  const ledgerBalance = ledger.balance
  const saldoAntes = input.saldoAntes

  const saldoAntesKnown = input.saldoAntesKnown ?? true
  const ledgerBalReliable = input.ledgerBalReliable ?? true
  const anchorDay = ledger.asOf ? ledger.asOf.toISOString().slice(0, 10) : null

  const effected = transactions.filter((t) => t.status === 'EFETIVADA')
  const sumEffected = round2(effected.reduce((s, t) => s + t.signedAmount, 0))
  const expectedBefore = round2(saldoAntes + sumEffected)

  const candOf = (t: (typeof transactions)[number]): JudgeCandidate => ({
    stableId: t.stableId,
    status: t.status,
    signedAmount: t.signedAmount,
    description: t.description,
  })
  const baseCandidates = transactions.map(candOf)

  const base = {
    ledgerBalance,
    saldoAntes,
    expectedBefore,
    reclassifications: [] as Reclassification[],
    searchMayHaveMissed: false,
    summary: { reclassUpToEffected: 0, reclassDownToScheduled: 0, boundedSearch: false, flippableCount: 0 },
  }

  // Sem LEDGERBAL não dá pra julgar. NÃO grava em silêncio — a tela decide.
  if (ledgerBalance == null) {
    return { ...base, outcome: 'NO_LEDGER', closes: false, expectedAfter: expectedBefore, gap: 0, effectedIds: effected.map((t) => t.stableId), candidates: baseCandidates }
  }

  const gap = round2(ledgerBalance - expectedBefore)

  // 1º IMPORT (sem LEDGERBAL anterior) → ANCORA, não valida contra o nada. A
  // abertura implícita = LEDGERBAL − Σ(EFETIVADA). Grava o que está efetivado.
  if (!saldoAntesKnown) {
    return { ...base, outcome: 'CLOSED_BY_OPENING_ANCHOR', closes: true, expectedAfter: expectedBefore, gap, effectedIds: effected.map((t) => t.stableId), candidates: [] }
  }

  // Fecha de primeira.
  if (Math.abs(gap) <= tol) {
    return { ...base, outcome: 'CLOSED', closes: true, expectedAfter: expectedBefore, gap, effectedIds: effected.map((t) => t.stableId), candidates: [] }
  }

  // Não fecha → tenta explicar reclassificando NOS DOIS SENTIDOS, mas SÓ o conjunto
  // pequeno e correto (senão a busca explode e limita à toa num Stone de 1500):
  //  - UP: AGENDADA/DESCONHECIDA (inerentemente incertas) → EFETIVADA (Σ += signed)
  //  - DOWN: EFETIVADA do DIA DA ÂNCORA (listada na emissão, pode não ter debitado)
  //          → AGENDADA (Σ -= signed). Fora do dia da âncora é histórico, não mexe.
  const upFlips = transactions
    .filter((t) => t.status === 'AGENDADA' || t.status === 'DESCONHECIDA')
    .map((line) => ({ line, delta: line.signedAmount, dir: 'UP' as const }))
  const downFlips = transactions
    .filter((t) => t.status === 'EFETIVADA' && anchorDay && t.datePosted.toISOString().slice(0, 10) === anchorDay)
    .map((line) => ({ line, delta: -line.signedAmount, dir: 'DOWN' as const }))
  const flips = [...upFlips, ...downFlips]

  const { solutions, bounded } = minimalSolvingSubsets(flips.map((f) => f.delta), gap, tol)
  const summary = { reclassUpToEffected: 0, reclassDownToScheduled: 0, boundedSearch: bounded, flippableCount: flips.length }

  // Nenhuma explicação fecha.
  if (solutions.length === 0) {
    // Banco cujo LEDGERBAL não fecha por design (Stone varre) → GRAVA avisando.
    if (!ledgerBalReliable) {
      return { ...base, outcome: 'WARN_UNRELIABLE_LEDGER', closes: true, expectedAfter: expectedBefore, gap, effectedIds: effected.map((t) => t.stableId), candidates: [], summary }
    }
    // Senão NÃO GRAVA. searchMayHaveMissed=true se a busca foi limitada (o "não
    // achei" pode ser "não achei entre as que consigo testar", não "não existe").
    return {
      ...base, outcome: 'BLOCKED_NO_EXPLANATION', closes: false, expectedAfter: expectedBefore, gap,
      effectedIds: effected.map((t) => t.stableId),
      candidates: flips.length > 0 ? flips.map((f) => candOf(f.line)) : baseCandidates,
      searchMayHaveMissed: bounded, summary,
    }
  }

  // 2+ explicações do mesmo tamanho mínimo → AMBÍGUO. Não chuta.
  if (solutions.length > 1) {
    const involved = new Set<number>(solutions.flat())
    return {
      ...base, outcome: 'BLOCKED_AMBIGUOUS', closes: false, expectedAfter: expectedBefore, gap,
      effectedIds: effected.map((t) => t.stableId),
      candidates: [...involved].map((i) => candOf(flips[i].line)), summary,
    }
  }

  // Exatamente UMA explicação mínima → aplica e registra.
  const chosen = solutions[0]
  const reclassifications: Reclassification[] = chosen.map((i) => {
    const f = flips[i]
    if (f.dir === 'UP') {
      return {
        stableId: f.line.stableId,
        from: f.line.status,
        to: 'EFETIVADA',
        signedAmount: f.line.signedAmount,
        reason:
          'O LEDGERBAL do banco já conta com esta linha — ela liquidou (estava marcada como não-efetivada).',
      }
    }
    return {
      stableId: f.line.stableId,
      from: 'EFETIVADA',
      to: 'AGENDADA',
      signedAmount: f.line.signedAmount,
      reason:
        'O LEDGERBAL do banco NÃO conta com esta linha — ainda não liquidou (o banco listou mas não debitou).',
    }
  })

  const flippedUp = new Set(reclassifications.filter((r) => r.to === 'EFETIVADA').map((r) => r.stableId))
  const flippedDown = new Set(reclassifications.filter((r) => r.to === 'AGENDADA').map((r) => r.stableId))
  const effectedIds = transactions
    .filter((t) => (t.status === 'EFETIVADA' || flippedUp.has(t.stableId)) && !flippedDown.has(t.stableId))
    .map((t) => t.stableId)

  const deltaSum = round2(chosen.reduce((s, i) => s + flips[i].delta, 0))
  const expectedAfter = round2(expectedBefore + deltaSum)

  return {
    outcome: 'CLOSED_AFTER_RECLASS',
    closes: true,
    ledgerBalance,
    saldoAntes,
    expectedBefore,
    expectedAfter,
    gap,
    reclassifications,
    effectedIds,
    candidates: [],
    searchMayHaveMissed: false,
    summary: {
      reclassUpToEffected: flippedUp.size,
      reclassDownToScheduled: flippedDown.size,
      boundedSearch: bounded,
      flippableCount: flips.length,
    },
  }
}
