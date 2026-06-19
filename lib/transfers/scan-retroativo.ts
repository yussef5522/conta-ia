// Sprint Transfer-Pairing-Retroativo (16/06/2026).
//
// Função PURA que varre tx OFX órfãs cross-account de UMA empresa e propõe
// pares de transferência interna. Diferente de findRetroactivePairs:
//   - Aceita MEDIUM (CONFIRM_THRESHOLD 0.70) além de HIGH (PAIR_THRESHOLD 0.85)
//   - Retorna `level: 'HIGH' | 'MEDIUM'` + `evidences` pra UI mostrar porque
//   - Aplica GATE adicional de NOME pra auto-pareamento seguro (regex
//     STRONG_OUTGOING em ambos os lados — bloqueia "RECARGA TELEFONE" etc)
//
// Reusa scorePair (Sprint R1) — mesma fórmula do preview e da varredura.
// CALLER (endpoint/import-confirm) decide se aplica ou só retorna candidatos.

import { extractOwnSignals, type OwnEntityRefs } from './own-entity-signals'
import {
  scorePair,
  PAIR_THRESHOLD,
  CONFIRM_THRESHOLD,
  MAX_DELTA_DAYS,
  MS_PER_DAY,
  CENT_TOLERANCE,
} from './score-pair'

export interface OrphanTxForScan {
  id: string
  bankAccountId: string
  bankAccountName: string
  date: Date
  type: 'CREDIT' | 'DEBIT' | string
  amount: number
  description: string
}

export type ScanLevel = 'HIGH' | 'MEDIUM'

export interface ScanRetroativoPair {
  from: OrphanTxForScan
  to: OrphanTxForScan
  confidence: number
  level: ScanLevel
  deltaDays: number
  evidences: string[]
  /**
   * Gate de NOME (Sprint Transfer-Pairing-Retroativo): true quando AMBOS os
   * lados batem keyword forte de transferência (PIX ENVIADO / PIX_DEB /
   * Transferência / TED / DOC / TRANSFER) OU own-entity signal.
   *
   * Caso real: saída "PIX ENVIADO" + entrada "YUSSEF Transferência" → true.
   * Caso real falso positivo: saída "RECARGA TELEFONE" + entrada "YUSSEF
   * Transferência" → false (saída NÃO tem keyword transfer).
   *
   * Auto-pareamento DEVE exigir level=HIGH && nameMatchOk=true.
   */
  nameMatchOk: boolean
}

export interface ScanRetroativoResult {
  pairs: ScanRetroativoPair[]
  // Counts agregados
  high: number
  mediumOnly: number
  pairableSafely: number // HIGH + nameMatchOk
}

// Regex pra verificar memo "tem cara de transferência interna"
// (mesma do score-pair.ts mas re-exportada aqui pra usar no gate de nome).
const STRONG_TRANSFER_KEYWORDS =
  /\b(transfer[eê]ncia|transferencia|transf|entre\s+contas|pix[\s_-]*deb|pix[\s_-]*enviado|pix[\s_-]*recebido|envio\s+pix|pagamento\s+pix|ted|doc)\b/i

// Exclusão: memos que claramente NÃO são transferência interna mesmo com PIX.
// Mantemos restritivo (3 categorias) pra não bloquear caso legítimo.
const EXCLUSION_KEYWORDS =
  /\b(recarga|telefone|tarifa\s+banc[aá]ria|mensalidade)\b/i

function hasTransferIntent(desc: string, refs: OwnEntityRefs): boolean {
  if (!desc) return false
  if (EXCLUSION_KEYWORDS.test(desc)) return false
  if (STRONG_TRANSFER_KEYWORDS.test(desc)) return true
  // Sem keyword forte: aceita se own-entity signal (CNPJ ou nome próprio
  // ou nome de conta própria) bate.
  const sig = extractOwnSignals(desc, refs)
  return sig.signalCount >= 1
}

/**
 * Varre tx órfãs (transferGroupId NULL, type CREDIT/DEBIT) e propõe pares
 * cross-account. CALLER responsável por carregar txs do DB.
 *
 * Greedy 1-to-1: cada tx só entra em 1 par. Empate em score → menor delta.
 */
export function scanRetroativo(input: {
  txs: OrphanTxForScan[]
  refs: OwnEntityRefs
  minConfidence?: number
}): ScanRetroativoResult {
  const minConf = input.minConfidence ?? CONFIRM_THRESHOLD

  const debits: OrphanTxForScan[] = []
  const credits: OrphanTxForScan[] = []
  for (const tx of input.txs) {
    if (tx.type === 'DEBIT') debits.push(tx)
    else if (tx.type === 'CREDIT') credits.push(tx)
  }

  // Sprint Import Idempotente FASE 7 (18/06/2026):
  // Antes era greedy POR-DEBIT, que perdia o pareamento ótimo quando
  // 2 DEBITs disputam o mesmo CREDIT — o iterado primeiro "roubava".
  // Cenário real Cacula 06/2026: 3 PIX YUSSEF órfãos viraram CRÉDITOS
  // categorizados como CUSTO porque o detector iterou em ordem que
  // priorizava pares sem nameOk.
  //
  // Nova abordagem: ENUMERA TODOS os candidatos válidos, ordena por
  // (nameMatchOk DESC, confidence DESC, deltaDays ASC), e PEGA gulosamente
  // em ordem. Garante:
  //   - tx só entra em 1 par (idempotência)
  //   - pares com nome próprio em AMBOS os lados ganham prioridade
  //   - empate em score -> menor distância de dia
  const allCandidates: ScanRetroativoPair[] = []
  for (const d of debits) {
    for (const c of credits) {
      if (Math.abs(c.amount - d.amount) > CENT_TOLERANCE) continue
      if (c.bankAccountId === d.bankAccountId) continue
      const delta = Math.abs(c.date.getTime() - d.date.getTime()) / MS_PER_DAY
      if (delta > MAX_DELTA_DAYS) continue
      const scoring = scorePair(d, c, input.refs)
      if (scoring.confidence < minConf) continue
      const level: ScanLevel =
        scoring.confidence >= PAIR_THRESHOLD ? 'HIGH' : 'MEDIUM'
      const nameMatchOk =
        hasTransferIntent(d.description, input.refs) &&
        hasTransferIntent(c.description, input.refs)
      allCandidates.push({
        from: d,
        to: c,
        confidence: scoring.confidence,
        level,
        deltaDays: scoring.deltaDays,
        evidences: scoring.evidences,
        nameMatchOk,
      })
    }
  }

  // Sort: nameMatchOk DESC -> confidence DESC -> deltaDays ASC -> level (HIGH primeiro)
  allCandidates.sort((a, b) => {
    if (a.nameMatchOk !== b.nameMatchOk) return a.nameMatchOk ? -1 : 1
    if (a.confidence !== b.confidence) return b.confidence - a.confidence
    if (a.deltaDays !== b.deltaDays) return a.deltaDays - b.deltaDays
    return 0
  })

  // Greedy 1-to-1: pega em ordem; pula se algum lado já foi usado
  const pairs: ScanRetroativoPair[] = []
  const usedIds = new Set<string>()
  for (const cand of allCandidates) {
    if (usedIds.has(cand.from.id) || usedIds.has(cand.to.id)) continue
    pairs.push(cand)
    usedIds.add(cand.from.id)
    usedIds.add(cand.to.id)
  }

  pairs.sort((a, b) => b.confidence - a.confidence)

  const high = pairs.filter((p) => p.level === 'HIGH').length
  const mediumOnly = pairs.filter((p) => p.level === 'MEDIUM').length
  const pairableSafely = pairs.filter((p) => p.level === 'HIGH' && p.nameMatchOk).length

  return { pairs, high, mediumOnly, pairableSafely }
}

// Re-exports
export { CONFIRM_THRESHOLD, PAIR_THRESHOLD }
