// Detecção heurística de transferências entre contas da MESMA empresa.
//
// Sprint R1 (10/06/2026): refatorado pra usar lib/transfers/score-pair.ts
// (fórmula UNIFICADA com varredura retroativa). Antes, preview tinha sua
// fórmula própria SEM own-entity-signals — daí "pega umas e falha em
// outras". Agora preview ganha CNPJ/nome/conta próprios "de graça".
//
// Caller (rota de preview OFX) deve passar:
//   - `transacoesNovas` (do arquivo OFX sendo importado)
//   - `outrasContasDaEmpresa` (tx existentes nas outras contas, ±7d)
//   - `contaSendoImportada` (id + name)
//   - `refs` (NOVO — OwnEntityRefs da empresa: cnpj + names + accountNames)
//
// THRESHOLDS (centralizados em score-pair.ts):
//   - HIGH ≥ 0.85  → action AUTO_PAIR
//   - MEDIUM ≥ 0.70 → action CONFIRM
//   - <0.70 → IGNORE (não vira candidato)

import {
  scorePair,
  actionForConfidence,
  CONFIRM_THRESHOLD,
  PAIR_THRESHOLD,
  CENT_TOLERANCE,
  MAX_DELTA_DAYS,
  MS_PER_DAY,
} from '@/lib/transfers/score-pair'
import type { OwnEntityRefs } from '@/lib/transfers/own-entity-signals'

export interface OfxCandidateTransaction {
  id: string
  description: string
  // amount sempre positivo; sinal vem do type (CREDIT=entrada, DEBIT=saída).
  amount: number
  type: 'CREDIT' | 'DEBIT' | string
  date: Date
}

export interface AccountTransactionsBundle {
  accountId: string
  accountName: string
  transactions: OfxCandidateTransaction[]
}

export type ConfidenceLevel = 'HIGH' | 'MEDIUM'
export type SuggestedAction = 'AUTO_PAIR' | 'CONFIRM' | 'IGNORE'

export interface TransferSideSnapshot {
  transactionId: string
  accountId: string
  date: Date
  amount: number
  description: string
}

export interface TransferEvidence {
  sameDay: boolean
  deltaDays: number
  amountExact: boolean
  keywordMatched: string | null // 'STRONG' | 'SOFT' | null (Sprint R1)
  /** Sprint R1: own-entity signals presentes (qualquer um dos 2 lados) */
  hasOwnCnpj: boolean
  hasOwnName: boolean
  hasOwnAccountName: boolean
}

export interface TransferCandidate {
  fromTransactionId: string
  toTransactionId: string
  fromAccountId: string
  toAccountId: string
  confidence: number
  confidenceLevel: ConfidenceLevel
  reason: string
  suggestedAction: SuggestedAction
  from: TransferSideSnapshot
  to: TransferSideSnapshot
  evidence: TransferEvidence
}

export interface DetectTransferResult {
  candidates: TransferCandidate[]
}

function diffInDays(a: Date, b: Date): number {
  const dayA = Math.floor(a.getTime() / MS_PER_DAY)
  const dayB = Math.floor(b.getTime() / MS_PER_DAY)
  return Math.abs(dayA - dayB)
}

/**
 * Sprint R1 (Gap 4): preview agora consome a fórmula UNIFICADA.
 *
 * `refs` é OPCIONAL pra retrocompat — se o caller não passar (chamadores
 * legados), usa OwnEntityRefs vazio (sem boost de CNPJ/nome). Mas o
 * endpoint /detectar-transferencias passa `refs` populadas pra ganhar
 * detecção melhor.
 */
export function detectarTransferenciasNoPreview(
  transacoesNovas: OfxCandidateTransaction[],
  outrasContasDaEmpresa: AccountTransactionsBundle[],
  contaSendoImportada: { id: string; name: string },
  refs: OwnEntityRefs = { cnpj: null, names: [], accountNames: [] },
): DetectTransferResult {
  const candidates: TransferCandidate[] = []

  type IndexedTx = OfxCandidateTransaction & {
    accountId: string
    accountName: string
  }
  const otherTxs: IndexedTx[] = []
  for (const bundle of outrasContasDaEmpresa) {
    if (bundle.accountId === contaSendoImportada.id) continue
    for (const tx of bundle.transactions) {
      otherTxs.push({
        ...tx,
        accountId: bundle.accountId,
        accountName: bundle.accountName,
      })
    }
  }

  for (const txNova of transacoesNovas) {
    for (const txOutra of otherTxs) {
      // Pré-filtros (baratos antes do scoring)
      if (Math.abs(txNova.amount - txOutra.amount) > CENT_TOLERANCE) continue
      const opposite =
        (txNova.type === 'CREDIT' && txOutra.type === 'DEBIT') ||
        (txNova.type === 'DEBIT' && txOutra.type === 'CREDIT')
      if (!opposite) continue
      const delta = diffInDays(txNova.date, txOutra.date)
      if (delta > MAX_DELTA_DAYS) continue

      // Fórmula UNIFICADA
      const scoring = scorePair(txNova, txOutra, refs)
      if (scoring.confidence < CONFIRM_THRESHOLD) continue

      // Direção: DEBIT → from, CREDIT → to
      const fromIsNova = txNova.type === 'DEBIT'
      const fromTx = fromIsNova ? txNova : txOutra
      const toTx = fromIsNova ? txOutra : txNova
      const fromAccountId = fromIsNova
        ? contaSendoImportada.id
        : txOutra.accountId
      const toAccountId = fromIsNova
        ? txOutra.accountId
        : contaSendoImportada.id

      const confidenceLevel: ConfidenceLevel =
        scoring.confidence >= PAIR_THRESHOLD ? 'HIGH' : 'MEDIUM'

      candidates.push({
        fromTransactionId: fromTx.id,
        toTransactionId: toTx.id,
        fromAccountId,
        toAccountId,
        confidence: scoring.confidence,
        confidenceLevel,
        reason: scoring.evidences.join(' + '),
        suggestedAction: actionForConfidence(scoring.confidence),
        from: {
          transactionId: fromTx.id,
          accountId: fromAccountId,
          date: fromTx.date,
          amount: fromTx.amount,
          description: fromTx.description,
        },
        to: {
          transactionId: toTx.id,
          accountId: toAccountId,
          date: toTx.date,
          amount: toTx.amount,
          description: toTx.description,
        },
        evidence: {
          sameDay: delta === 0,
          deltaDays: delta,
          amountExact: true,
          keywordMatched: scoring.matchedKeyword,
          hasOwnCnpj: scoring.evidences.includes('CNPJ próprio'),
          hasOwnName: scoring.evidences.includes('Nome da empresa'),
          hasOwnAccountName: scoring.evidences.includes('Nome de conta própria'),
        },
      })
    }
  }

  // Ordena por confiança desc (UI mostra melhores primeiro)
  candidates.sort((a, b) => b.confidence - a.confidence)

  return { candidates }
}
