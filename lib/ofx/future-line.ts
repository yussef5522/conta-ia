// Sprint Preview-Truth (29/06/2026) — corte de linha futura.
//
// Tx OFX com date FUTURA (banco exportou agendado/previsão) NÃO é movimento
// efetivado — vira PAYABLE/RECEIVABLE (Conta a Pagar/Receber) e NÃO afeta
// saldo. Quando a data chegar e o débito real aparecer no extrato, concilia
// com essa pending.
//
// Cenário Yussef: Banrisul exporta "PAGAMENTO CONSORCIO 09/07 R$1.478,51"
// no extrato de 29/06. Antes virava EFFECTED inflando o caixa errado.
//
// TIMEZONE: corte usa fim do dia em America/Sao_Paulo (BRT-3 sem horário
// de verão). Server roda UTC; uma tx de "29/06 23:59 BRT" é "30/06 02:59
// UTC". Sem cuidado, o cálculo cego em UTC marca essa tx como "futura".
// O diagnóstico achou 73 tx 29/06 sendo falsos positivos pra esse motivo.

import { fitidLooksLikeDate } from '../reconciliation/is-preview'

const SAO_PAULO_OFFSET_HOURS = -3 // BRT permanente (Lei 14.001/2020)
const ONE_HOUR_MS = 60 * 60 * 1000

/**
 * Retorna a data (UTC instant) que representa o FIM DO DIA "today" em
 * America/Sao_Paulo. Linhas com `datePosted > essa instant` são genuinamente
 * futuras (hoje BRT já passou pra elas).
 *
 * @param now Instant atual (default new Date()). Aceitar param facilita test.
 */
export function endOfTodayBrazil(now: Date = new Date()): Date {
  // 1. now em "hora local Brasil" via shift do offset.
  const brazilLocal = new Date(now.getTime() + SAO_PAULO_OFFSET_HOURS * ONE_HOUR_MS)
  // 2. Pega year/month/day do tempo deslocado.
  const y = brazilLocal.getUTCFullYear()
  const m = brazilLocal.getUTCMonth()
  const d = brazilLocal.getUTCDate()
  // 3. Constrói "fim do dia BRT" (23:59:59.999 local) em UTC.
  //    Convertendo: 23:59:59.999 BRT = 02:59:59.999 UTC do DIA SEGUINTE.
  //    Em milissegundos: Date.UTC(y, m, d+1, 0, 0, 0, 0) - 1 (último ms do dia BRT).
  //    Aplicando offset reverso:
  return new Date(Date.UTC(y, m, d, 23, 59, 59, 999) - SAO_PAULO_OFFSET_HOURS * ONE_HOUR_MS)
}

/**
 * Linha do extrato com `datePosted` é genuinamente FUTURA (banco exportou
 * agendado) se for posterior ao fim do dia "today" em BRT?
 */
export function isFutureLineBrazil(
  datePosted: Date,
  now: Date = new Date(),
): boolean {
  return datePosted.getTime() > endOfTodayBrazil(now).getTime()
}

/**
 * DECISÃO DE PRODUTO (07/08): extrato bancário só registra o que JÁ aconteceu.
 * Linha com data FUTURA é DESCARTADA no import (não vira transação) — igual
 * Xero/QuickBooks/Mercury (extrato = passado; previsão vem de Contas a Pagar
 * cadastradas). Evita o casamento preview↔real (fonte das 31 duplicatas).
 *
 * Critério: a linha é FUTURA se a data for posterior ao **DTASOF** do arquivo
 * (data em que o banco fechou o extrato). O DTASOF é a âncora correta — tudo que
 * vem depois dele é AGENDADO por definição (o banco não o considerou liquidado).
 * `fitidLooksLikePreview` é a rede secundária do Banrisul (FITID YYMMDD).
 *
 * ⚠️ BUG CORRIGIDO (09/08/2026): o critério antigo era `> DTASOF **E** > fim de
 * hoje (BRT)`. O `&& > hoje` (relógio de parede) deixava passar linhas agendadas
 * quando o extrato era importado UM DIA DEPOIS: p/ o Extrato_20260809 (DTASOF
 * 09/08, agendadas 10/11/17), importar em 10/08 fazia as de 10/08 deixarem de
 * ser "> hoje" → ofertadas. O DTASOF não muda com o relógio; ele manda. E o pior:
 * o TESTE fixava now=09/08 (= DTASOF) → passava verde enquanto a produção (que
 * rodou em 10/08) quebrava. `now` foi removido do critério (mantido na assinatura
 * só por compat com os callers).
 *
 * Consistência com o fechamento: DTASOF vem do LEDGERBAL (mesma fonte do saldo);
 * descartar tudo > DTASOF faz Σ(EFFECTED) == LEDGERBAL por construção. Se o DTASOF
 * viesse errado, a validação Σ(EFFECTED) x LEDGERBAL avisa.
 */
export function isFutureStatementLine(
  datePosted: Date,
  /** Âncora "liquidado até aqui" = max(DTASOF, DTEND). Ver settledThroughDate. */
  anchor: Date,
  fitidLooksLikePreview: boolean,
  _now: Date = new Date(), // não usado no critério (ver bug acima); mantido por compat
): boolean {
  const lineDay = datePosted.toISOString().slice(0, 10)
  const anchorDay = anchor.toISOString().slice(0, 10)
  const futuroPorData = lineDay > anchorDay
  return futuroPorData || fitidLooksLikePreview
}

/**
 * Âncora de descarte = a MAIS TARDIA entre DTASOF (data do saldo) e DTEND (fim
 * do período de transações). Usar as duas evita os dois erros opostos:
 *  - só DTASOF: um DTASOF anterior à última linha real descartaria real (silêncio);
 *  - só relógio (`now`): importar no dia seguinte deixava a agendada de +1 passar.
 * max(DTASOF, DTEND) é now-independente E não descarta movimento dentro do período.
 * Retorna null se ambos ausentes (caller decide o fallback).
 */
export function settledThroughDate(
  asOfDate: Date | null | undefined,
  statementEnd: Date | null | undefined,
): Date | null {
  const a = asOfDate ?? null
  const b = statementEnd ?? null
  if (!a) return b
  if (!b) return a
  return a.getTime() >= b.getTime() ? a : b
}

/**
 * HELPER CENTRAL (#8) — separa linhas de extrato em REAIS vs FUTURAS.
 * TODO caminho de import de extrato bancário DEVE usar este helper (ou passar
 * pelo runImportV2, que o usa) — assim o descarte de futuro é UM lugar só e não
 * volta a divergir entre telas. Guard em __tests__ garante que ninguém esquece.
 */
export function partitionFutureLines<T extends { datePosted: Date; fitid?: string | null }>(
  lines: T[],
  dtAsOf: Date,
  now: Date = new Date(),
): { realLines: T[]; futureLines: T[] } {
  const realLines: T[] = []
  const futureLines: T[] = []
  for (const l of lines) {
    const previewFitid = fitidLooksLikeDate(l.fitid ?? undefined, l.datePosted)
    if (isFutureStatementLine(l.datePosted, dtAsOf, previewFitid, now)) futureLines.push(l)
    else realLines.push(l)
  }
  return { realLines, futureLines }
}

// ───────────────────────────────────────────────────────────────
// CAMADA 2 — reconciliação contra o LEDGERBAL (11/08/2026)
// ───────────────────────────────────────────────────────────────
//
// BUG que motivou (11/08): a CAMADA 1 (data) usa `> âncora`, então a linha
// com data IGUAL à âncora passa como "real". O banco emite o extrato às 01h
// JÁ LISTANDO um débito que só vai liquidar às 9h (PAGAMENTO CONSORCIO
// -1.478,51 em 11/08, âncora 11/08). Pela DATA ela é "passado"; só o SALDO
// DECLARADO pelo banco (LEDGERBAL) revela que ainda não liquidou — o
// LEDGERBAL -781,08 NÃO a inclui.
//
// PRINCÍPIO (mesmo dos empréstimos): parar de inferir por data e LER o que o
// banco entrega. O LEDGERBAL é o saldo real AGORA — fato, não inferência.
//
// CRITÉRIO: se `balanceAtual + Σ(linhas novas efetivadas)` NÃO fecha com o
// LEDGERBAL, alguma linha não liquidou. Se a diferença bate EXATO com um
// subconjunto de linhas do DIA DA ÂNCORA, essas são agendadas (independe da
// data). Fora do dia da âncora NÃO mexe (é divergência histórica, outro
// problema). Ambiguidade (2+ subconjuntos mínimos somam a diferença) ou
// nenhum casamento → NÃO chuta: devolve residual pro caller avisar.

export interface LedgerReconcileLine {
  /** Identificador estável da linha (dedupHash/ofxIndex) pra devolver ao caller. */
  key: string
  type: 'CREDIT' | 'DEBIT'
  amount: number
  datePosted: Date
}

export interface AnchorDayScheduleResult {
  /** Linhas do dia da âncora a reclassificar como AGENDADAS (não importar). */
  scheduledKeys: string[]
  /** true = diferença explicada e zerada (subconjunto único encontrado). */
  resolved: boolean
  /** true = 2+ subconjuntos mínimos somam a diferença → não escolher sozinho. */
  ambiguous: boolean
  /** Diferença que sobra (LEDGERBAL − saldoPos). 0 quando resolved. */
  residualDiff: number
  /** Todas as linhas do dia da âncora consideradas (pra UI/diagnóstico). */
  anchorDayKeys: string[]
}

const LEDGER_RECONCILE_TOLERANCE = 0.02
/** Acima disso, só busca singletons+pares (evita powerset explodir). */
const FULL_ENUMERATION_CAP = 12

function signedOf(l: { type: 'CREDIT' | 'DEBIT'; amount: number }): number {
  return l.type === 'CREDIT' ? l.amount : -l.amount
}

function roundCents(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Enumera subconjuntos NÃO-vazios de `lines` cujo Σ(signed) ≈ target (±tol).
 * Retorna listas de keys, ordenadas por tamanho ASC. Limita custo: powerset
 * só até FULL_ENUMERATION_CAP linhas; acima disso, singletons + pares.
 */
function subsetsSummingTo(
  lines: LedgerReconcileLine[],
  target: number,
  tol: number,
): string[][] {
  const matches: string[][] = []
  const n = lines.length
  const signed = lines.map(signedOf)

  if (n <= FULL_ENUMERATION_CAP) {
    // Powerset (2^n − 1). n≤12 → ≤4095 iterações.
    for (let mask = 1; mask < 1 << n; mask++) {
      let sum = 0
      const keys: string[] = []
      for (let i = 0; i < n; i++) {
        if (mask & (1 << i)) {
          sum += signed[i]
          keys.push(lines[i].key)
        }
      }
      if (Math.abs(sum - target) <= tol) matches.push(keys)
    }
  } else {
    // Muitas linhas no dia: só singletons + pares (custo O(n²)).
    for (let i = 0; i < n; i++) {
      if (Math.abs(signed[i] - target) <= tol) matches.push([lines[i].key])
    }
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (Math.abs(signed[i] + signed[j] - target) <= tol) {
          matches.push([lines[i].key, lines[j].key])
        }
      }
    }
  }
  matches.sort((a, b) => a.length - b.length)
  return matches
}

/**
 * CAMADA 2: reconcilia as linhas novas contra o LEDGERBAL declarado e, quando
 * a diferença bate exato com um subconjunto do DIA DA ÂNCORA, devolve essas
 * linhas pra serem tratadas como AGENDADAS (não importadas).
 *
 * Devolve `resolved:false` (sem tocar em nada) quando:
 *  - a diferença já fecha (nada a fazer, `resolved:true` mas `scheduledKeys` vazio);
 *  - nenhum subconjunto do dia da âncora bate (residual != 0, caller avisa);
 *  - ambiguidade: 2+ subconjuntos mínimos batem (`ambiguous:true`, mostra candidatas).
 */
export function reconcileLedgerAnchorDay(input: {
  newLines: LedgerReconcileLine[]
  balanceAtual: number
  ledgerBalance: number
  anchor: Date
  tolerance?: number
}): AnchorDayScheduleResult {
  const tol = input.tolerance ?? LEDGER_RECONCILE_TOLERANCE
  const sumNew = input.newLines.reduce((s, l) => s + signedOf(l), 0)
  const saldoPos = roundCents(input.balanceAtual + sumNew)
  const diff = roundCents(input.ledgerBalance - saldoPos)

  const anchorDay = input.anchor.toISOString().slice(0, 10)
  const anchorLines = input.newLines.filter(
    (l) => l.datePosted.toISOString().slice(0, 10) === anchorDay,
  )
  const anchorDayKeys = anchorLines.map((l) => l.key)

  // Já fecha → nada a agendar.
  if (Math.abs(diff) <= tol) {
    return { scheduledKeys: [], resolved: true, ambiguous: false, residualDiff: 0, anchorDayKeys }
  }

  // Removendo o subconjunto S, saldoPos muda em −Σsigned(S). Pra saldoPos virar
  // LEDGERBAL: Σsigned(S) = saldoPos − LEDGERBAL = −diff.
  const target = roundCents(-diff)
  const subsets = subsetsSummingTo(anchorLines, target, tol)

  if (subsets.length === 0) {
    // Nada no dia da âncora explica → NÃO chuta (divergência histórica/outra).
    return { scheduledKeys: [], resolved: false, ambiguous: false, residualDiff: diff, anchorDayKeys }
  }

  const minSize = subsets[0].length
  const minimal = subsets.filter((s) => s.length === minSize)
  if (minimal.length > 1) {
    // 2+ subconjuntos mínimos batem → ambíguo, não escolher sozinho.
    return { scheduledKeys: [], resolved: false, ambiguous: true, residualDiff: diff, anchorDayKeys }
  }

  return { scheduledKeys: minimal[0], resolved: true, ambiguous: false, residualDiff: 0, anchorDayKeys }
}

/**
 * Lifecycle resolvido pra uma linha do extrato.
 * - Tx futura DEBIT: PAYABLE (Conta a Pagar pendente)
 * - Tx futura CREDIT: RECEIVABLE (Conta a Receber pendente)
 * - Tx no passado/hoje: EFFECTED (movimento já realizado)
 */
export function lifecycleFromDate(
  datePosted: Date,
  type: 'CREDIT' | 'DEBIT' | 'TRANSFER' | string,
  now: Date = new Date(),
): 'EFFECTED' | 'PAYABLE' | 'RECEIVABLE' {
  if (!isFutureLineBrazil(datePosted, now)) return 'EFFECTED'
  if (type === 'CREDIT') return 'RECEIVABLE'
  return 'PAYABLE'
}
