// Sprint PF Fatia 3 — Dup contra tx manuais já lançadas.
//
// Estratégia: pra cada tx do OFX, busca tx manual no mesmo cartão
// com:
//   - mesma DATA ±1 dia
//   - mesmo VALOR (centavos exatos)
//   - DESCRIÇÃO similar (Jaccard token ≥ 0.7)
//
// FUNÇÃO PURA: recebe arrays + retorna DupMatch[].

import { detectInstallment } from './detect-installment'

export type DupReason =
  | 'EXACT_AMOUNT_DATE_DESC'   // tudo bate (alta confiança)
  | 'INSTALLMENT_GROUP'         // parcela X/Y bate com grupo manual existente
  | 'FUZZY_DESC'                // valor + data ok mas descrição parcial

export interface ManualTxLite {
  id: string
  date: Date
  amount: number
  description: string
  installmentGroupId?: string | null
  installmentNumber?: number | null
  installmentTotal?: number | null
}

export interface OfxTxLite {
  fitid: string
  date: Date
  amount: number
  description: string
}

export interface DupMatch {
  ofxFitid: string
  manualTxId: string
  reason: DupReason
  confidence: number
}

/**
 * Tokens da descrição (lowercase, sem acentos, sem prefix-strip do PJ).
 * NÃO usa normalizeDescription (que stripa prefix antes de " - " — formato PJ).
 */
function tokenize(desc: string): Set<string> {
  const n = (desc ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
  const parts = n.split(/[^a-z0-9]+/).filter((t) => t.length > 2)
  return new Set(parts)
}

/** Jaccard similarity entre 2 sets. */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1
  let inter = 0
  for (const t of a) if (b.has(t)) inter++
  const union = a.size + b.size - inter
  return union === 0 ? 0 : inter / union
}

const DAY_MS = 24 * 60 * 60 * 1000

export function findDuplicatesAgainstManual(
  ofxTxs: OfxTxLite[],
  manualTxs: ManualTxLite[],
): DupMatch[] {
  if (ofxTxs.length === 0 || manualTxs.length === 0) return []

  const matches: DupMatch[] = []
  const usedManual = new Set<string>()

  // Pré-computa tokens das manuais
  const manualTokens = new Map<string, Set<string>>()
  for (const m of manualTxs) {
    manualTokens.set(m.id, tokenize(m.description))
  }

  for (const ofx of ofxTxs) {
    const ofxTokens = tokenize(ofx.description)
    const ofxInstall = detectInstallment(ofx.description)

    // 1. Tenta match por installmentGroup primeiro (alta confiança)
    if (ofxInstall.isInstallment && ofxInstall.baseDescription) {
      for (const m of manualTxs) {
        if (usedManual.has(m.id)) continue
        if (!m.installmentGroupId) continue
        if (m.installmentNumber !== ofxInstall.installmentNumber) continue
        if (m.installmentTotal !== ofxInstall.installmentTotal) continue
        if (Math.abs(m.amount - ofx.amount) > 0.01) continue
        // descrição base parecida
        const mTokens = tokenize(m.description.replace(/\(\d+\/\d+\)\s*$/, ''))
        const sim = jaccard(ofxTokens, mTokens)
        if (sim >= 0.3) {
          matches.push({
            ofxFitid: ofx.fitid,
            manualTxId: m.id,
            reason: 'INSTALLMENT_GROUP',
            confidence: 0.95,
          })
          usedManual.add(m.id)
          break
        }
      }
      if (matches.find((d) => d.ofxFitid === ofx.fitid)) continue
    }

    // 2. Match por (data ±1 dia + amount exato + jaccard ≥ 0.7)
    for (const m of manualTxs) {
      if (usedManual.has(m.id)) continue
      // Data ±1 dia
      const diffDays = Math.abs(ofx.date.getTime() - m.date.getTime()) / DAY_MS
      if (diffDays > 1.5) continue
      // Amount exato (centavos)
      if (Math.abs(m.amount - ofx.amount) > 0.01) continue
      const mTokens = manualTokens.get(m.id) ?? new Set<string>()
      const sim = jaccard(ofxTokens, mTokens)
      if (sim >= 0.5) {
        matches.push({
          ofxFitid: ofx.fitid,
          manualTxId: m.id,
          reason: 'EXACT_AMOUNT_DATE_DESC',
          confidence: Math.min(0.95, 0.7 + sim * 0.25),
        })
        usedManual.add(m.id)
        break
      } else if (sim >= 0.3) {
        // Fuzzy — confiança média
        matches.push({
          ofxFitid: ofx.fitid,
          manualTxId: m.id,
          reason: 'FUZZY_DESC',
          confidence: 0.6 + sim * 0.2,
        })
        usedManual.add(m.id)
        break
      }
    }
  }

  return matches
}
