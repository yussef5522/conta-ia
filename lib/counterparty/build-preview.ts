// Sprint Tela Contraparte (31/07/2026) — monta o PREVIEW do enriquecimento a
// partir do PDF parseado + transações JÁ EXISTENTES. FUNÇÃO PURA, read-only:
// não grava, não cria, não altera valor/data/categoria. Só decide QUAL nome
// atribuir a QUAL transação (via joinPdfStatement) e enriquece pra exibição.

import type { ParsedBankStatement } from '@/lib/bank-statement-pdf/types'
import { joinPdfStatement, type JoinTxInput } from './join-pdf-statement'

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
  counts: {
    exact: number
    ambiguousKeys: number
    ambiguousTx: number
    noMatch: number
    pdfLines: number
    pdfWithName: number
    manualProtected: number
  }
  exact: Array<PreviewTxView & { proposedName: string; documento: string }>
  ambiguous: Array<{
    documento: string
    amount: number
    candidateNames: string[]
    txs: PreviewTxView[]
  }>
}

const onlyDigits = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '')
// Normaliza número de conta/agência pra comparar: só dígitos + tira zeros à
// esquerda (formatação irrelevante). "06.055341.0-6" e "0605534106" viram
// "605534106"; "0230" e "230" viram "230". String vazia continua vazia.
const normAccount = (s: string | null | undefined) => onlyDigits(s).replace(/^0+/, '')

/** FASE 1.3a — cabeçalho do PDF (agência+conta) bate com a conta selecionada?
 *  Normaliza os DOIS lados (só dígitos, sem zeros à esquerda) antes de comparar —
 *  o Banrisul emite a conta ora formatada (06.055341.0-6) ora não (0605534106). */
export function headerMatchesAccount(
  header: { agencia: string | null; conta: string | null },
  conta: { agency: string | null; accountNumber: string | null },
): boolean {
  const agA = normAccount(header.agencia)
  const agB = normAccount(conta.agency)
  const ccA = normAccount(header.conta)
  const ccB = normAccount(conta.accountNumber)
  // Se a conta não tem ag/cc cadastrada, não dá pra validar → não bloqueia por isso.
  const agOk = !agA || !agB || agA === agB
  const ccOk = !ccA || !ccB || ccA === ccB
  return agOk && ccOk
}

function view(t: EnrichTx): PreviewTxView {
  return {
    txId: t.id,
    date: t.date.toISOString().slice(0, 10),
    description: t.description,
    amount: t.amount,
    type: t.type,
    currentName: t.counterpartyName,
  }
}

export function buildEnrichmentPreview(
  parsed: ParsedBankStatement,
  txs: EnrichTx[],
): EnrichmentPreview {
  const joinTx: JoinTxInput[] = txs.map((t) => ({
    id: t.id,
    externalId: t.externalId,
    amount: t.amount,
    description: t.description,
    counterpartySource: t.counterpartySource,
  }))
  const r = joinPdfStatement(parsed.lines, joinTx)
  const byId = new Map(txs.map((t) => [t.id, t]))

  const exact = r.exact
    .map((e) => {
      const t = byId.get(e.txId)
      // FASE 4 (09/08): expõe o `documento` do PDF pra ser persistido em
      // counterpartyDocument (distingue os 2 "EMPRESTIMO", capitalizações).
      return t ? { ...view(t), proposedName: e.counterpartyName, documento: e.documento } : null
    })
    .filter(
      (x): x is PreviewTxView & { proposedName: string; documento: string } => x !== null,
    )

  const ambiguous = r.ambiguous.map((a) => ({
    documento: a.documento,
    amount: a.amount,
    candidateNames: a.candidateNames,
    txs: a.txIds.map((id) => byId.get(id)).filter((t): t is EnrichTx => !!t).map(view),
  }))

  return {
    counts: {
      exact: r.stats.exactCount,
      ambiguousKeys: r.stats.ambiguousKeys,
      ambiguousTx: r.stats.ambiguousTxCount,
      noMatch: r.stats.noMatchCount,
      pdfLines: parsed.lines.length,
      pdfWithName: parsed.lines.filter((l) => l.counterpartyName).length,
      manualProtected: r.stats.manualProtected,
    },
    exact,
    ambiguous,
  }
}
