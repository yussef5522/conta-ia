// Sprint PF Fatia 3.5 — Validações (4 camadas) pós-extração.
//
// FUNÇÃO PURA. Recebe PdfExtractResult cru do Claude → ajusta confidence
// global, adiciona warnings, decide se DEVE rejeitar.
//
// Camadas:
//   1. Soma das tx ≈ declaredTotal (tolerância R$ 0,50)
//   2. Count tx ≈ declaredTxCount (tolerância ±1)
//   3. Confidence por linha contribui pra global
//   4. Quality scan: MOBILE_PHOTO ou SCANNED_LOW → rejeita

import type { PdfExtractResult, ScanQuality } from './types'

const SUM_TOLERANCE_BRL = 0.5
const REJECT_QUALITIES: ScanQuality[] = ['MOBILE_PHOTO']

export interface ValidationOutcome {
  result: PdfExtractResult
  /** true = rejeita import (foto/scan muito ruim) */
  shouldReject: boolean
  rejectReason?: string
}

export function validateExtraction(raw: PdfExtractResult): ValidationOutcome {
  const warnings = [...(raw.warnings ?? [])]
  let confidenceMultipliers: number[] = []

  // === Camada 4: Quality ===
  if (REJECT_QUALITIES.includes(raw.scanQuality)) {
    return {
      result: raw,
      shouldReject: true,
      rejectReason:
        'Detectamos que isso é uma foto de celular. Por favor, envie o PDF DIGITAL da fatura (baixado do app ou site do banco), não uma foto.',
    }
  }

  // === Camada 1: Soma=Total ===
  if (
    raw.declaredTotal != null &&
    raw.extractedSum != null &&
    isFinite(raw.declaredTotal) &&
    isFinite(raw.extractedSum)
  ) {
    const diff = Math.abs(raw.declaredTotal - raw.extractedSum)
    const diffPct = raw.declaredTotal > 0 ? diff / raw.declaredTotal : 0
    if (diff > SUM_TOLERANCE_BRL) {
      warnings.push(
        `⚠️ Soma das transações (R$ ${raw.extractedSum.toFixed(2)}) ≠ total da fatura (R$ ${raw.declaredTotal.toFixed(2)}). Diferença R$ ${diff.toFixed(2)}.`,
      )
      // Penaliza confidence proporcionalmente
      if (diffPct < 0.02) confidenceMultipliers.push(0.85)
      else if (diffPct < 0.10) confidenceMultipliers.push(0.6)
      else confidenceMultipliers.push(0.4)
    }
  } else if (raw.declaredTotal == null) {
    warnings.push(
      'Não detectamos o total da fatura no PDF — não foi possível validar a soma.',
    )
    confidenceMultipliers.push(0.85)
  }

  // === Camada 2: Count ===
  if (
    raw.declaredTxCount != null &&
    Math.abs(raw.declaredTxCount - raw.transactions.length) > 1
  ) {
    warnings.push(
      `⚠️ PDF declara ${raw.declaredTxCount} transações, extraímos ${raw.transactions.length}.`,
    )
    confidenceMultipliers.push(0.7)
  }

  // === Camada 3: Confidence média ponderada das linhas ===
  const txCount = raw.transactions.length
  let lineAvg = 1
  if (txCount > 0) {
    const sum = raw.transactions.reduce((s, t) => s + (t.lineConfidence ?? 1), 0)
    lineAvg = sum / txCount
  }
  // Quanto menor a média, mais penaliza
  if (lineAvg < 0.85) {
    confidenceMultipliers.push(lineAvg)
  }

  // === Quality penalty (sem rejeitar) ===
  switch (raw.scanQuality) {
    case 'SCANNED_LOW':
      confidenceMultipliers.push(0.55)
      warnings.push(
        '⚠️ Qualidade do scan é BAIXA. Revise CADA linha antes de confirmar.',
      )
      break
    case 'SCANNED_HIGH':
      confidenceMultipliers.push(0.85)
      break
    case 'UNKNOWN':
      confidenceMultipliers.push(0.7)
      break
    // DIGITAL: sem penalidade
  }

  // Combinar confidence: Claude declarou × cada multiplier
  let combined = raw.confidence ?? 0.85
  for (const m of confidenceMultipliers) combined *= m
  combined = Math.max(0, Math.min(1, combined))

  return {
    result: {
      ...raw,
      confidence: combined,
      warnings,
    },
    shouldReject: false,
  }
}
