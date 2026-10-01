// Sprint Tela Contraparte (31/07/2026) — monta o PREVIEW do enriquecimento a
// partir do PDF parseado + transações JÁ EXISTENTES. FUNÇÃO PURA, read-only:
// não grava, não cria, não altera valor/data/categoria. Só decide QUAL nome
// atribuir a QUAL transação (via joinPdfStatement) e enriquece pra exibição.
//
// FASE 4 (13/08): a tela conta CERTO. O "385 sem match" era mentira — a maioria
// é não-elegível (IOF/tarifa: nunca terá nome) ou de OUTRO período (falta o PDF
// do mês). O universo real é PIX/TED sem nome DENTRO do período do PDF. Os 4
// baldes tornam isso óbvio.

import type { ParsedBankStatement, StatementPeriod } from '@/lib/bank-statement-pdf/types'
import { joinPdfStatement, type JoinTxInput, type MatchKey } from './join-pdf-statement'
import { isCounterpartyEligible } from './gap'
import { podeReceberNomeDoPdf, seloDaPulada, type MotivoDaPulada } from './pode-receber-nome'

export interface EnrichTx {
  id: string
  externalId: string | null
  amount: number
  date: Date
  description: string
  type: string
  counterpartyName: string | null
  counterpartySource: string | null
}

export interface PreviewTxView {
  txId: string
  date: string
  description: string
  amount: number
  type: string
  currentName: string | null
}

export interface EnrichmentPreview {
  period: StatementPeriod | null
  altKeyUsed: boolean
  counts: {
    // ── os 4 baldes ──
    willReceive: number // vão receber nome (exact, FITID+data)
    ambiguousTx: number // ambíguas — você escolhe
    outOfPeriod: number // elegível sem nome, mas de OUTRO período (falta o PDF do mês)
    notApplicable: number // IOF/tarifa/antecipação — nunca têm contraparte
    /**
     * ⭐⭐ 30/09 — AS QUE O PDF ALCANÇOU E JÁ ESTAVAM FEITAS. **Contadas, não re-oferecidas.**
     *
     * ⛔ Era este número que faltava: sem ele o dono mandava o PDF do mês, via *"vão receber
     * nome (12)"* com lançamentos que ele tinha nomeado na semana anterior, e não tinha como
     * saber se o trabalho passado pegou. *Arquivo que some é indistinguível de trabalho que
     * não aconteceu.*
     */
    jaResolvidas: number
    // ── detalhe ──
    noPdfLine: number // elegível, no período, mas o PDF não tem nome pra ela
    exactByFitid: number
    exactByDateAmount: number
    ambiguousKeys: number
    pdfLines: number
    pdfWithName: number
    manualProtected: number
  }
  progress: { named: number; totalEligible: number } // "N de M com nome" — a CONTA INTEIRA
  /**
   * ⭐⭐ 30/09 — O PROGRESSO **DO PERÍODO DESTE PDF**, ao lado do da conta inteira.
   *
   * ⛔⛔ **O defeito que isto conserta:** o dono rodou o período até 20/09 e leu
   * *"28 de 94 com nome"* — e achou baixo, com razão. **A aritmética estava certa** (20 de
   * agosto + 8 de setembro = 28 de 94 elegíveis da conta), mas ela respondia *"a conta
   * inteira"* ao lado de um PDF de **um mês**. Os 66 que faltam são **jun (23) e jul (43)**,
   * que precisam de OUTRO PDF — e isso o `outOfPeriodMonths` já sabia dizer.
   *
   * ⭐ `null` quando o PDF não declara período: inventar um recorte seria pior que não ter.
   */
  progressoNoPeriodo: { named: number; totalEligible: number } | null
  // meses fora do período que ainda têm elegíveis sem nome (pra sugerir o PDF)
  outOfPeriodMonths: Array<{ month: string; count: number }>
  exact: Array<PreviewTxView & { proposedName: string; documento: string; matchKey: MatchKey }>
  /** ⭐ as puladas, COM o porquê — a tela mostra o selo em vez de esconder a linha */
  puladas: Array<PreviewTxView & { nomeDoPdf: string; motivo: MotivoDaPulada; selo: string }>
  ambiguous: Array<{
    documento: string
    amount: number
    candidateNames: string[]
    via: MatchKey
    txs: PreviewTxView[]
  }>
}

const onlyDigits = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '')
const normAccount = (s: string | null | undefined) => onlyDigits(s).replace(/^0+/, '')

/** FASE 1.3a — cabeçalho do PDF (agência+conta) bate com a conta selecionada? */
export function headerMatchesAccount(
  header: { agencia: string | null; conta: string | null },
  conta: { agency: string | null; accountNumber: string | null },
): boolean {
  const agA = normAccount(header.agencia)
  const agB = normAccount(conta.agency)
  const ccA = normAccount(header.conta)
  const ccB = normAccount(conta.accountNumber)
  const agOk = !agA || !agB || agA === agB
  const ccOk = !ccA || !ccB || ccA === ccB
  return agOk && ccOk
}

const isoOf = (d: Date) => d.toISOString().slice(0, 10)
const inPeriod = (iso: string, p: StatementPeriod | null) =>
  !!p && iso >= p.start && iso <= p.end

function view(t: EnrichTx): PreviewTxView {
  return {
    txId: t.id,
    date: isoOf(t.date),
    description: t.description,
    amount: t.amount,
    type: t.type,
    currentName: t.counterpartyName,
  }
}

export function buildEnrichmentPreview(
  parsed: ParsedBankStatement,
  txs: EnrichTx[],
  opts: { altKey?: boolean } = {},
): EnrichmentPreview {
  const period = parsed.period
  const joinTx: JoinTxInput[] = txs.map((t) => ({
    id: t.id,
    externalId: t.externalId,
    amount: t.amount,
    description: t.description,
    counterpartySource: t.counterpartySource,
    counterpartyName: t.counterpartyName,
    dateIso: isoOf(t.date),
  }))
  const r = joinPdfStatement(parsed.lines, joinTx, { altKey: opts.altKey })
  const byId = new Map(txs.map((t) => [t.id, t]))

  const exact = r.exact
    .map((e) => {
      const t = byId.get(e.txId)
      return t
        ? { ...view(t), proposedName: e.counterpartyName, documento: e.documento, matchKey: e.matchKey }
        : null
    })
    .filter(
      (x): x is PreviewTxView & { proposedName: string; documento: string; matchKey: MatchKey } =>
        x !== null,
    )

  /**
   * ⭐ AS PULADAS COM NOME — contadas e explicadas, como o OFX faz com linha repetida.
   * ⚠️ Ordenadas por DATA (não pela ordem do mapa interno), senão a lista parece aleatória.
   */
  const puladas = r.puladas
    .map((p) => {
      const t = byId.get(p.txId)
      return t ? { ...view(t), nomeDoPdf: p.nomeDoPdf, motivo: p.motivo, selo: seloDaPulada(p.motivo) } : null
    })
    .filter((x): x is PreviewTxView & { nomeDoPdf: string; motivo: MotivoDaPulada; selo: string } => x !== null)
    .sort((a, b) => a.date.localeCompare(b.date))

  const ambiguous = r.ambiguous.map((a) => ({
    documento: a.documento,
    amount: a.amount,
    candidateNames: a.candidateNames,
    via: a.via,
    txs: a.txIds.map((id) => byId.get(id)).filter((t): t is EnrichTx => !!t).map(view),
  }))

  // ── Baldes: classifica CADA tx sem nome que NÃO virou exact/ambíguo ──────────
  const resolved = new Set<string>([...r.exact.map((e) => e.txId), ...ambiguous.flatMap((a) => a.txs.map((t) => t.txId))])
  let outOfPeriod = 0
  let notApplicable = 0
  let noPdfLine = 0
  const outMonths = new Map<string, number>()
  // progresso: elegíveis no total (com nome ou não) e quantos já têm nome
  let totalEligible = 0
  let named = 0

  // ⭐ as puladas NÃO entram nos baldes de pendência — elas têm balde próprio
  const puladasIds = new Set(puladas.map((p) => p.txId))
  // ⭐ o progresso DO PERÍODO: mesma régua, recorte do PDF
  let eligNoPeriodo = 0
  let namedNoPeriodo = 0

  for (const t of txs) {
    const elig = isCounterpartyEligible(t.description)
    if (elig) {
      totalEligible++
      if (t.counterpartyName) named++
      if (inPeriod(isoOf(t.date), period)) {
        eligNoPeriodo++
        if (t.counterpartyName) namedNoPeriodo++
      }
    }
    if (t.counterpartyName) continue // já resolvida
    if (puladasIds.has(t.id)) continue // tem balde próprio (já resolvida / precedência)
    if (resolved.has(t.id)) continue // virou willReceive ou ambígua
    if (t.counterpartySource === 'MANUAL') continue
    if (!elig) {
      notApplicable++ // IOF/tarifa/antecipação — nunca têm contraparte
    } else if (!inPeriod(isoOf(t.date), period)) {
      outOfPeriod++ // elegível, mas de outro período → falta o PDF daquele mês
      const m = isoOf(t.date).slice(0, 7)
      outMonths.set(m, (outMonths.get(m) ?? 0) + 1)
    } else {
      noPdfLine++ // elegível, no período, mas o PDF não trouxe nome
    }
  }

  return {
    period,
    altKeyUsed: !!opts.altKey,
    counts: {
      willReceive: r.stats.exactCount,
      ambiguousTx: r.stats.ambiguousTxCount,
      outOfPeriod,
      notApplicable,
      jaResolvidas: r.stats.jaResolvidas,
      noPdfLine,
      exactByFitid: r.stats.exactByFitid,
      exactByDateAmount: r.stats.exactByDateAmount,
      ambiguousKeys: r.stats.ambiguousKeys,
      pdfLines: parsed.lines.length,
      pdfWithName: parsed.lines.filter((l) => l.counterpartyName).length,
      manualProtected: r.stats.manualProtected,
    },
    progress: { named, totalEligible },
    progressoNoPeriodo: period ? { named: namedNoPeriodo, totalEligible: eligNoPeriodo } : null,
    outOfPeriodMonths: [...outMonths.entries()]
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month)),
    exact,
    puladas,
    ambiguous,
  }
}
