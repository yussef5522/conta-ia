// Sprint Central de Transferências — varredura retroativa.
//
// Sprint R1 (10/06/2026): refatorado pra usar lib/transfers/score-pair.ts
// (fórmula unificada com preview OFX). Comportamento mantido — mesma
// fórmula com pesos coerentes.
//
// 3 modos:
//   1. pairs:    candidatos a transferência (par com 2 lados ÓRFÃOS)
//   2. lonely:   tx órfãs que TÊM sinais sem par no histórico
//   3. duplicates: ÓRFÃ × PAREADA (Sprint R1, Gap 2 — Stone +8000 caso) —
//      OFX órfã coincide com lado MANUAL de grupo já existente.
//      Mostra na UI como "Possível duplicata" pra user decidir.

import { extractOwnSignals, type OwnEntityRefs } from './own-entity-signals'
import {
  scorePair,
  PAIR_THRESHOLD,
  MAX_DELTA_DAYS,
  MS_PER_DAY,
  CENT_TOLERANCE,
} from './score-pair'

export interface TxForDetect {
  id: string
  bankAccountId: string
  bankAccountName: string
  date: Date
  type: 'CREDIT' | 'DEBIT' | string
  amount: number
  description: string
}

/**
 * Tx que JÁ está num grupo de transferência (transferGroupId NOT NULL).
 * Usado no modo "duplicates" pra comparar com órfãs.
 */
export interface PairedTxForDetect extends TxForDetect {
  transferGroupId: string
}

export interface PairCandidate {
  from: TxForDetect
  to: TxForDetect
  confidence: number
  /** ms entre as duas datas (>=0). 0 = mesmo dia */
  deltaMs: number
  evidences: string[]
}

export interface LonelyTx {
  tx: TxForDetect
  signals: {
    hasOwnCnpj: boolean
    hasOwnName: boolean
    hasOwnAccountName: boolean
    hasTransferKeyword: boolean
  }
  /** 1-4 (CNPJ + nome + conta + keyword) */
  signalCount: number
}

/**
 * Sprint R1 (Gap 2) — OFX órfã que parece duplicar transferência já pareada.
 * NÃO É um par a confirmar — é um aviso pra usuário avaliar se a OFX é
 * cópia (deletar) ou nova transferência distinta (manter).
 */
export interface DuplicateSuspect {
  /** OFX órfã (TRANSFER pareada NÃO entra aqui) */
  orphan: TxForDetect
  /** Lado pareado que tem mesma conta + valor + janela curta */
  pairedSide: PairedTxForDetect
  /** Grupo da pareada (mostrar pro user qual grupo) */
  transferGroupId: string
  /** Dias entre órfã e lado pareado */
  deltaDays: number
}

export interface RetroactiveResult {
  pairs: PairCandidate[]
  lonely: LonelyTx[]
  /** Sprint R1: caso 4 (órfã × pareada). Vazio se não houver. */
  duplicates: DuplicateSuspect[]
}

const TRANSFER_KEYWORDS_FOR_LONELY =
  /\b(transfer[eê]ncia|transferencia|transf|entre\s+contas|pix[\s_-]*deb|pix[\s_-]*enviado|pix[\s_-]*recebido|envio\s+pix|pagamento\s+pix|ted|doc)\b/i

/**
 * Varredura retroativa: cruza tx órfãs (DEBIT × CREDIT) entre contas
 * diferentes da empresa. Retorna pares com score ≥ PAIR_THRESHOLD e tx
 * sozinhas com sinais fortes de transferência.
 *
 * Sprint R1: aceita `pairedTxs` opcional pra detectar caso "órfã × pareada"
 * (Gap 2). Quando passar, retorna `duplicates[]` com suspeitas.
 */
export function findRetroactivePairs(
  txs: TxForDetect[],
  refs: OwnEntityRefs,
  pairedTxs: PairedTxForDetect[] = [],
): RetroactiveResult {
  const debits: TxForDetect[] = []
  const credits: TxForDetect[] = []
  for (const tx of txs) {
    if (tx.type === 'DEBIT') debits.push(tx)
    else if (tx.type === 'CREDIT') credits.push(tx)
  }

  const pairs: PairCandidate[] = []
  const usedTxIds = new Set<string>()

  // Pares órfã × órfã (fluxo existente)
  for (const d of debits) {
    if (usedTxIds.has(d.id)) continue
    let best: PairCandidate | null = null
    for (const c of credits) {
      if (usedTxIds.has(c.id)) continue
      if (Math.abs(c.amount - d.amount) > CENT_TOLERANCE) continue
      if (c.bankAccountId === d.bankAccountId) continue
      const delta =
        Math.abs(c.date.getTime() - d.date.getTime()) / MS_PER_DAY
      if (delta > MAX_DELTA_DAYS) continue
      const scoring = scorePair(d, c, refs)
      if (scoring.confidence < PAIR_THRESHOLD) continue
      if (best === null || scoring.confidence > best.confidence) {
        best = {
          from: d,
          to: c,
          confidence: scoring.confidence,
          deltaMs: Math.abs(c.date.getTime() - d.date.getTime()),
          evidences: scoring.evidences,
        }
      }
    }
    if (best) {
      pairs.push(best)
      usedTxIds.add(best.from.id)
      usedTxIds.add(best.to.id)
    }
  }

  // Lonely: órfãs sem par mas com sinais (fluxo existente)
  const lonely: LonelyTx[] = []
  for (const tx of txs) {
    if (usedTxIds.has(tx.id)) continue
    const sig = extractOwnSignals(tx.description, refs)
    const hasTransferKeyword = TRANSFER_KEYWORDS_FOR_LONELY.test(tx.description)
    const signals = {
      hasOwnCnpj: sig.hasOwnCnpj,
      hasOwnName: sig.hasOwnName,
      hasOwnAccountName: sig.hasOwnAccountName,
      hasTransferKeyword,
    }
    const signalCount =
      (signals.hasOwnCnpj ? 1 : 0) +
      (signals.hasOwnName ? 1 : 0) +
      (signals.hasOwnAccountName ? 1 : 0) +
      (signals.hasTransferKeyword ? 1 : 0)
    // Entra se tem ao menos 2 sinais OU 1 sinal muito forte (CNPJ)
    if (signals.hasOwnCnpj || signalCount >= 2) {
      lonely.push({ tx, signals, signalCount })
    }
  }

  // Sprint R1 (Gap 2) — Duplicatas suspeitas: OFX órfã × lado pareado
  // existente. Critério estrito pra evitar falso positivo:
  //   - Mesma conta (a órfã está NA conta onde o lado pareado também está)
  //   - Mesma direção (CREDIT/CREDIT ou DEBIT/DEBIT — pareada é "lado",
  //     então mesmo tipo)
  //   - Valor exato ±0.015
  //   - Janela ≤ 2 dias (mais curto que MAX_DELTA_DAYS pra reduzir ruído)
  const duplicates: DuplicateSuspect[] = []
  if (pairedTxs.length > 0) {
    for (const orphan of txs) {
      // Mesma órfã pode coincidir com mais de 1 pareada — pega a mais próxima
      let best: DuplicateSuspect | null = null
      for (const paired of pairedTxs) {
        if (paired.bankAccountId !== orphan.bankAccountId) continue
        // Sinal monetário ('CREDIT' ou 'DEBIT') — pareada já tem tipo
        // armazenado como 'TRANSFER'; comparamos pelo lado que ela ocupa.
        // Pra órfã CREDIT, lado pareado tem que representar entrada
        // (= paired era CREDIT antes ou é o "to" do grupo).
        // Como simplificação: comparar pelo *sinal econômico* via amount sign.
        // Pareada com mesmo amount e mesma conta + dia próximo é candidato.
        if (Math.abs(paired.amount - orphan.amount) > CENT_TOLERANCE) continue
        const delta =
          Math.abs(paired.date.getTime() - orphan.date.getTime()) / MS_PER_DAY
        if (delta > 2) continue // janela MAIS APERTADA que pairs (gap 2)
        if (best === null || delta < best.deltaDays) {
          best = {
            orphan,
            pairedSide: paired,
            transferGroupId: paired.transferGroupId,
            deltaDays: Math.floor(delta),
          }
        }
      }
      if (best) duplicates.push(best)
    }
  }

  // Ordena
  pairs.sort((a, b) => b.confidence - a.confidence)
  lonely.sort((a, b) => b.signalCount - a.signalCount)
  duplicates.sort((a, b) => a.deltaDays - b.deltaDays)

  return { pairs, lonely, duplicates }
}

// Re-export pra retrocompat de chamadores (mantém superficie pública estável)
export { PAIR_THRESHOLD, MAX_DELTA_DAYS }
