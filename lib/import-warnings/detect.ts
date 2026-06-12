// Fase 4 (Yussef 12/06/2026) — Detector de duplicação pós-import.
//
// Função PURA: recebe arrays de tx, retorna warnings. Zero acesso DB.
//
// Critérios pra gerar warning (cada newTx vs cada existingTx):
//   1. mesmo bankAccountId
//   2. amount ±R$ 0,02
//   3. data ±1 dia
//   4. type igual
//   5. existingTx.createdAt < newTx.createdAt (criada ANTES)
//   6. id diferente
//   7. NEM new NEM existing têm rec link conhecido (sistema NÃO sabe que é dup)
//   8. descrição similar (Jaro-Winkler ≥ 0.80, normalização operacional)
//
// PROTEÇÃO COMPRA REPETIDA REAL (mesmo guardião da Fase 1):
//   - Match guloso 1:1 ordenado por createdAt da newTx
//   - Cada existingTx só pode ser "claim-ada" UMA vez
//   - Resultado: se sistema tem 1 R$ 105 e lote tem 2 R$ 105, gera 1 warning
//     (a 2ª real não tem candidato → não é warning)

import { jaroWinkler } from '@/lib/conciliacao/jaro-winkler'

// ───────────────────────────────────────────────────────────────
// Tipos públicos
// ───────────────────────────────────────────────────────────────

export interface NewTxForDetect {
  id: string
  bankAccountId: string
  amount: number
  date: Date
  description: string
  type: 'CREDIT' | 'DEBIT' | 'TRANSFER' | string
  origin: string
  createdAt: Date
  /** Já tem link reconciledWithId set */
  hasReconciledLink: boolean
  /** Quantas outras tx apontam pra ela via reconciledWithId */
  reconciledFromCount: number
}

export interface ExistingTxForDetect {
  id: string
  bankAccountId: string
  amount: number
  date: Date
  description: string
  type: 'CREDIT' | 'DEBIT' | 'TRANSFER' | string
  createdAt: Date
  hasReconciledLink: boolean
  reconciledFromCount: number
}

export interface DetectedWarning {
  newTxId: string
  suspectedDupId: string
  similarity: number
  reason: string
}

export interface DetectInput {
  newTxs: NewTxForDetect[]
  existingTxs: ExistingTxForDetect[]
  /** Janela de data ±N dias (default 1) */
  dateWindowDays?: number
  /** Threshold Jaro-Winkler (default 0.80) */
  descriptionThreshold?: number
}

// ───────────────────────────────────────────────────────────────
// Constantes
// ───────────────────────────────────────────────────────────────

const AMOUNT_TOLERANCE = 0.02
const ONE_DAY_MS = 24 * 60 * 60 * 1000
const DEFAULT_DATE_WINDOW_DAYS = 1
const DEFAULT_DESC_THRESHOLD = 0.80

// ───────────────────────────────────────────────────────────────
// Helpers (puros)
// ───────────────────────────────────────────────────────────────

function normalizeOperationalDesc(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')  // remove acentos
    .replace(/\d{4,}/g, '')             // strippa números longos (FITIDs voláteis)
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function descriptionSimilarity(a: string, b: string): number {
  const normA = normalizeOperationalDesc(a)
  const normB = normalizeOperationalDesc(b)
  if (!normA || !normB) return 0
  if (normA === normB) return 1
  return jaroWinkler(normA, normB)
}

function amountClose(a: number, b: number): boolean {
  return Math.abs(a - b) <= AMOUNT_TOLERANCE
}

function dateWithinDays(a: Date, b: Date, days: number): boolean {
  const diffMs = Math.abs(a.getTime() - b.getTime())
  return diffMs <= days * ONE_DAY_MS
}

// ───────────────────────────────────────────────────────────────
// Core
// ───────────────────────────────────────────────────────────────

/**
 * Detecta possíveis duplicações entre newTxs (recém-criadas) e existingTxs
 * (pré-existentes no sistema).
 *
 * Match guloso 1:1 ordenado por createdAt das newTxs (proteção compra repetida).
 */
export function detectDuplicatesPostImport(input: DetectInput): DetectedWarning[] {
  const dateWindowDays = input.dateWindowDays ?? DEFAULT_DATE_WINDOW_DAYS
  const threshold = input.descriptionThreshold ?? DEFAULT_DESC_THRESHOLD

  // Clona existing com flag de claim
  const existing = input.existingTxs.map((e) => ({ ...e, claimed: false }))

  // Ordena newTxs por createdAt ASC (mais antiga primeiro)
  const newSorted = [...input.newTxs].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  )

  const warnings: DetectedWarning[] = []

  for (const newTx of newSorted) {
    // newTx que JÁ tem link conhecido (sistema sabe) → não gera warning
    if (newTx.hasReconciledLink || newTx.reconciledFromCount > 0) continue

    let best: { idx: number; similarity: number } | null = null

    for (let i = 0; i < existing.length; i++) {
      const ex = existing[i]
      if (ex.claimed) continue
      if (ex.id === newTx.id) continue
      if (ex.bankAccountId !== newTx.bankAccountId) continue
      if (ex.type !== newTx.type) continue
      if (!amountClose(ex.amount, newTx.amount)) continue
      if (!dateWithinDays(ex.date, newTx.date, dateWindowDays)) continue
      // existing precisa ser criada ANTES da new
      if (ex.createdAt.getTime() >= newTx.createdAt.getTime()) continue
      // existing JÁ tem link conhecido → sistema sabe, não polui warnings
      if (ex.hasReconciledLink || ex.reconciledFromCount > 0) continue

      const sim = descriptionSimilarity(newTx.description, ex.description)
      if (sim < threshold) continue

      if (!best || sim > best.similarity) {
        best = { idx: i, similarity: sim }
      }
    }

    if (best) {
      existing[best.idx].claimed = true
      warnings.push({
        newTxId: newTx.id,
        suspectedDupId: existing[best.idx].id,
        similarity: best.similarity,
        reason: 'Tx criada agora casa com tx pré-existente do mesmo valor, data próxima e descrição similar — possível duplicação que escapou do classificador.',
      })
    }
  }

  return warnings
}
