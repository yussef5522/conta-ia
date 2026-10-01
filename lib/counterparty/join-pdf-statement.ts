// Sprint Contraparte PIX (31/07/2026) — FASE 5: JOIN puro entre as linhas do PDF
// (com NOME) e as transações JÁ EXISTENTES do OFX. NÃO grava nada, NÃO cria, NÃO
// altera valor/data/categoria. Só decide QUAL nome atribuir a QUAL transação.
//
// NÍVEL 1 (preferencial): (DOCUMENTO == externalId/FITID, valor absoluto).
// NÍVEL 2 (Banrisul, FASE 4 13/08): quando o FITID NÃO casa, (data completa,
//   valor absoluto). Existe SÓ porque o FITID do Banrisul renumera a cada
//   download (fitidStability='PER_DOWNLOAD' no perfil de banco). Sicredi/Stone
//   têm FITID estável e NUNCA entram no Nível 2 (o caller passa altKey=false).
//
// Classificação (nos dois níveis):
//  - EXACT: a chave tem UM único nome no PDF e UMA única tx → atribui.
//  - AMBIGUOUS: 2+ nomes divergentes OU 2+ tx pra mesma chave → NÃO adivinha.
//  - NO_MATCH: nenhuma linha do PDF com nome pra aquela chave.
//
// Conservador de propósito: erro visível > perda silenciosa. Nome MANUAL nunca
// é proposto pra sobrescrita. Cada atribuição registra POR ONDE veio (matchKey).

import { normalizeCounterparty } from './normalize'
import { isCounterpartyEligible } from './gap'
import { podeReceberNomeDoPdf, type MotivoDaPulada } from './pode-receber-nome'
import type { BankStatementLine } from '@/lib/bank-statement-pdf/types'

export type MatchKey = 'FITID' | 'DATE_AMOUNT'

export interface JoinTxInput {
  id: string
  externalId: string | null // FITID == DOCUMENTO do PDF
  amount: number // absoluto
  description: string
  counterpartySource: string | null // se 'MANUAL', protegido
  counterpartyName?: string | null // se já tem nome, não propõe
  dateIso?: string | null // YYYY-MM-DD (chave do Nível 2)
}

export interface CounterpartyAssignment {
  txId: string
  counterpartyName: string
  documento: string
  amount: number
  confidence: 'EXACT'
  /** Por onde veio o nome — pra auditar/reverter em lote se der errado. */
  matchKey: MatchKey
}
export interface AmbiguousKey {
  documento: string
  amount: number
  candidateNames: string[]
  txIds: string[]
  /** FITID = mesmo documento; DATE_AMOUNT = mesma data+valor (Nível 2). */
  via: MatchKey
}
/**
 * ⭐ A LINHA QUE O PDF ALCANÇOU mas que NÃO entra na lista — **contada e explicada**.
 *
 * ⛔ Sem isto a linha simplesmente desaparecia da tela, e *arquivo que some é
 * indistinguível de trabalho que não aconteceu*. Era a dúvida exata do dono.
 */
export interface PuladaComNome {
  txId: string
  motivo: MotivoDaPulada
  /** o nome que o PDF traria — pra a tela mostrar que o PDF CONCORDA (ou não) */
  nomeDoPdf: string
}

export interface JoinResult {
  exact: CounterpartyAssignment[]
  ambiguous: AmbiguousKey[]
  noMatchTxIds: string[]
  /** ⭐ 30/09 — as que o PDF alcançou e já estavam resolvidas (ou são do banco) */
  puladas: PuladaComNome[]
  stats: {
    txTotal: number
    exactCount: number
    exactByFitid: number
    exactByDateAmount: number
    ambiguousKeys: number
    ambiguousTxCount: number
    noMatchCount: number
    manualProtected: number
    /** ⭐ quantas o PDF alcançou e já estavam feitas — o número que faltava na tela */
    jaResolvidas: number
  }
}

const fitidKey = (documento: string, amount: number) =>
  `${documento.toUpperCase()}|${amount.toFixed(2)}`
const dateKey = (dateIso: string, amount: number) => `${dateIso}|${amount.toFixed(2)}`

export function joinPdfStatement(
  pdfLines: BankStatementLine[],
  txs: JoinTxInput[],
  opts: { altKey?: boolean } = {},
): JoinResult {
  // ── PDF indexado por chave (só linhas COM nome) ──────────────────────────────
  const pdfByFitid = new Map<string, Map<string, string>>() // fitidKey → (norm → display)
  const pdfByDate = new Map<string, Map<string, string>>() // dateKey → (norm → display)
  for (const l of pdfLines) {
    if (!l.counterpartyName) continue
    const norm = normalizeCounterparty(l.counterpartyName)
    if (!norm) continue
    const display = l.counterpartyName.trim()
    const kf = fitidKey(l.documento, l.amount)
    if (!pdfByFitid.has(kf)) pdfByFitid.set(kf, new Map())
    if (!pdfByFitid.get(kf)!.has(norm)) pdfByFitid.get(kf)!.set(norm, display)
    if (l.date) {
      const kd = dateKey(l.date, l.amount)
      if (!pdfByDate.has(kd)) pdfByDate.set(kd, new Map())
      if (!pdfByDate.get(kd)!.has(norm)) pdfByDate.get(kd)!.set(norm, display)
    }
  }

  const exact: CounterpartyAssignment[] = []
  const ambiguous: AmbiguousKey[] = []
  const noMatchTxIds: string[] = []
  const puladas: PuladaComNome[] = []
  let manualProtected = 0
  const handled = new Set<string>() // txIds já resolvidos (exact ou ambiguous)

  // ── NÍVEL 1: FITID == DOCUMENTO ──────────────────────────────────────────────
  const txByFitid = new Map<string, JoinTxInput[]>()
  for (const t of txs) {
    if (!t.externalId) continue
    const k = fitidKey(t.externalId, Math.abs(t.amount))
    if (!txByFitid.has(k)) txByFitid.set(k, [])
    txByFitid.get(k)!.push(t)
  }

  for (const [k, group] of txByFitid) {
    const names = pdfByFitid.get(k)
    /**
     * ⛔⛔⛔ ERA AQUI O DEFEITO DE 30/09 — este filtro olhava SÓ `MANUAL`.
     *
     * Resultado medido em prod: o PDF de 01–30/09 re-ofereceu **22 de 22** linhas que JÁ
     * tinham nome, todas `via FITID`, e o confirm as pulava por precedência gravando ZERO.
     * *Oferecer → preservar → oferecer de novo*, pra sempre.
     *
     * ⭐ Agora os DOIS níveis consultam `podeReceberNomeDoPdf` — que por dentro chama a
     * MESMA `canApplyCounterparty` do confirm. A lista não tem como oferecer o que a
     * gravação recusa.
     */
    const candidatos: JoinTxInput[] = []
    for (const t of group) {
      const v = podeReceberNomeDoPdf(t)
      if (v.pode) { candidatos.push(t); continue }
      if (v.motivo === 'PRECEDENCIA') manualProtected++
      // ⚠️ só é "pulada COM nome" se o PDF realmente alcançou a chave — senão ela é
      // simplesmente uma linha que o PDF não cobre, e dizer "pulada" seria inventar.
      if (names && names.size > 0) {
        puladas.push({ txId: t.id, motivo: v.motivo!, nomeDoPdf: [...names.values()][0] })
        handled.add(t.id)
      }
    }
    if (!names || names.size === 0) continue // deixa pro Nível 2 / no-match
    if (names.size === 1) {
      const display = [...names.values()][0]
      const [documento, amountStr] = k.split('|')
      for (const t of candidatos) {
        exact.push({
          txId: t.id, counterpartyName: display, documento,
          amount: parseFloat(amountStr), confidence: 'EXACT', matchKey: 'FITID',
        })
        handled.add(t.id)
      }
    } else {
      const [documento, amountStr] = k.split('|')
      ambiguous.push({
        documento, amount: parseFloat(amountStr),
        candidateNames: [...names.values()], txIds: candidatos.map((t) => t.id), via: 'FITID',
      })
      candidatos.forEach((t) => handled.add(t.id))
    }
  }

  // ── NÍVEL 2: (data, valor) — SÓ Banrisul (altKey), FITID não resolveu ────────
  if (opts.altKey) {
    // candidatos: elegível (PIX/TED/DOC não-tarifa), sem nome, não-manual, com
    // data, e ainda não resolvido pelo FITID.
    /**
     * ⚠️ ESTAS CONDIÇÕES ERAM UMA SEGUNDA LISTA, correta **por coincidência**. Passaram a
     * ser a MESMA `podeReceberNomeDoPdf` do Nível 1 — senão a assimetria que causou o
     * defeito de 30/09 renasce no primeiro critério novo, no nível que ninguém olhar.
     */
    const altCandidates = txs.filter((t) => !handled.has(t.id) && t.dateIso && podeReceberNomeDoPdf(t).pode)
    const txByDate = new Map<string, JoinTxInput[]>()
    for (const t of altCandidates) {
      const k = dateKey(t.dateIso!, Math.abs(t.amount))
      if (!txByDate.has(k)) txByDate.set(k, [])
      txByDate.get(k)!.push(t)
    }
    for (const [k, group] of txByDate) {
      const names = pdfByDate.get(k)
      if (!names || names.size === 0) continue // genuinamente sem nome no PDF
      const [dateIso, amountStr] = k.split('|')
      const amount = parseFloat(amountStr)
      if (names.size === 1 && group.length === 1) {
        exact.push({
          txId: group[0].id, counterpartyName: [...names.values()][0],
          documento: dateIso, amount, confidence: 'EXACT', matchKey: 'DATE_AMOUNT',
        })
        handled.add(group[0].id)
      } else {
        // 2+ nomes divergentes OU 2+ tx pra mesma data+valor → não adivinha.
        ambiguous.push({
          documento: dateIso, amount,
          candidateNames: [...names.values()], txIds: group.map((t) => t.id), via: 'DATE_AMOUNT',
        })
        group.forEach((t) => handled.add(t.id))
      }
    }
  }

  // ── NO_MATCH: elegível, sem nome, sem manual, e não resolvido em nenhum nível ─
  for (const t of txs) {
    if (handled.has(t.id)) continue
    if (t.counterpartyName) continue
    if (t.counterpartySource === 'MANUAL') continue
    noMatchTxIds.push(t.id)
  }

  const exactByFitid = exact.filter((e) => e.matchKey === 'FITID').length
  return {
    exact,
    ambiguous,
    noMatchTxIds,
    puladas,
    stats: {
      txTotal: txs.length,
      exactCount: exact.length,
      exactByFitid,
      exactByDateAmount: exact.length - exactByFitid,
      ambiguousKeys: ambiguous.length,
      ambiguousTxCount: ambiguous.reduce((s, a) => s + a.txIds.length, 0),
      noMatchCount: noMatchTxIds.length,
      manualProtected,
      jaResolvidas: puladas.length,
    },
  }
}
