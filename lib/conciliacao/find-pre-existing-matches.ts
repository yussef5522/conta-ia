// Sprint 3-Bugs Fase 1 (Yussef 12/06/2026) — Dedup robusto a FITID reciclado.
//
// Problema: Banrisul (e outros bancos BR) violam o padrão OFX e RECICLAM
// FITIDs entre exports. dedupHash = sha256(fitid+data+valor+memo) muda → tx
// duplica silenciosamente no import.
//
// Solução: match guloso 1:1 ordenado por valor + data + descrição normalizada
// (sem depender do FITID). 4 prioridades:
//   1. OFX já existe (Bug 3)
//   2. MANUAL provisória esperando substituição (Bug 2)
//   3. Excel PAYABLE esperando pagamento (Bug 1)
//   4. Genuinamente nova
//
// FUNÇÃO PURA: recebe candidatos como parâmetro, retorna classificação.
// ZERO acesso a banco, ZERO delete, ZERO mutação. Quem orquestra DB chama
// esta função e decide o que fazer com base no resultado.
//
// Filosofia (estudo Conta Azul / Mercury / QuickBooks): NUNCA delete sozinho.
// Esta função só CLASSIFICA. User decide no preview o que fazer.

import { normalizeForMatch } from './normalize-for-match'
import { jaroWinkler } from './jaro-winkler'

// ────────────────────────────────────────────────────────────────
// Tipos
// ────────────────────────────────────────────────────────────────

export type ClassifyAction =
  | 'SKIP_DUP'              // já existe no sistema (Bug 3: OFX↔OFX)
  | 'REPLACE_MANUAL'        // substitui MANUAL provisória (Bug 2)
  | 'CONCILIATE_PAYABLE'    // concilia com Excel PAYABLE pendente (Bug 1)
  | 'CREATE_NEW'            // genuinamente nova

export interface IncomingOfxTx {
  /** Posição da tx no arquivo OFX (pra ordem do guloso) */
  index: number
  bankAccountId: string
  /** Valor absoluto (>0) */
  amount: number
  /** UTC normalizado (00:00:00.000Z) */
  date: Date
  description: string
  type: 'CREDIT' | 'DEBIT'
}

export interface ExistingCandidate {
  id: string
  bankAccountId: string | null  // PAYABLE não tem bankAccount
  amount: number
  date: Date
  description: string
  type: 'CREDIT' | 'DEBIT'
  origin: 'OFX' | 'MANUAL' | 'IMPORT_EXCEL' | 'ADJUSTMENT'
  lifecycle: 'EFFECTED' | 'PAYABLE' | 'RECEIVABLE'
  /** Tem reconciledWithId set (já conciliada com OFX) */
  hasReconciledLink: boolean
  /** Já foi "claim-ada" por outra OFX deste import (in-memory) */
  claimedInThisImport?: boolean
}

export interface ClassifyResult {
  ofxTxIndex: number
  action: ClassifyAction
  /** ID do candidato que casou (se SKIP/REPLACE/CONCILIATE) */
  matchedTxId?: string
  /** Diferença de valor quando concilia (positiva = OFX > Excel = juros) */
  diff?: number
  /** Score do match (descrição) — só pra confiança visual */
  similarity?: number
  /** Razão humana */
  reason: string
}

export interface FindMatchesInput {
  incoming: IncomingOfxTx[]
  candidates: ExistingCandidate[]
  /** Threshold mínimo de similaridade (Jaro-Winkler) pra considerar match.
   *  Default 0.80 (decisão Yussef 11/06/2026). */
  descriptionThreshold?: number
}

// ────────────────────────────────────────────────────────────────
// Janelas de tolerância
// ────────────────────────────────────────────────────────────────

const AMOUNT_TOLERANCE = 0.02
const ONE_DAY_MS = 24 * 60 * 60 * 1000

/** Janela em dias por prioridade. OFX-vs-OFX e OFX-vs-MANUAL: ±1d (banco
 *  processa D ou D+1). OFX-vs-Excel PAYABLE: ±5d (boleto pode adiantar/atrasar). */
const DATE_WINDOW_DAYS = {
  OFX: 1,
  MANUAL: 1,
  IMPORT_EXCEL: 5,
} as const

const DEFAULT_DESC_THRESHOLD = 0.80

// ────────────────────────────────────────────────────────────────
// Utilitários puros
// ────────────────────────────────────────────────────────────────

/** Normaliza data pra meia-noite UTC (lição do estudo: evita bug timezone). */
export function normalizeUTC(d: Date): Date {
  const date = new Date(d)
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function amountClose(a: number, b: number): boolean {
  return Math.abs(a - b) <= AMOUNT_TOLERANCE
}

function dateWithinDays(a: Date, b: Date, days: number): boolean {
  const diffMs = Math.abs(normalizeUTC(a).getTime() - normalizeUTC(b).getTime())
  return diffMs <= days * ONE_DAY_MS
}

/** Normalizer dedicado pra OFX-vs-OFX e OFX-vs-MANUAL:
 *  - lowercase + sem acentos
 *  - strippa números longos (≥4 dígitos) — FITIDs/IDs que Banrisul muda entre exports
 *  - PRESERVA descrição operacional ("PIX ENVIADO", "DEBITO STONE", "ANTECIP STONE")
 *
 *  Diferente de normalizeForMatch (que strippa sufixos comerciais pensando em
 *  OFX-vs-Excel, onde Excel tem só "TOZZO ALIMENTOS" sem "- Pagamento"). */
function normalizeOfxOperationalDesc(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // remove acentos
    .replace(/\d{4,}/g, '')             // strippa FITIDs/IDs longos
    .replace(/[^\w\s-]/g, ' ')          // só letras/dígitos/espaços/hífens
    .replace(/\s+/g, ' ')
    .trim()
}

/** Similaridade pra OFX-vs-OFX (Bug 3 dedup). Preserva descrição operacional,
 *  strippa apenas FITIDs/IDs voláteis. */
export function descriptionSimilarity(a: string, b: string): number {
  const normA = normalizeOfxOperationalDesc(a)
  const normB = normalizeOfxOperationalDesc(b)
  if (!normA || !normB) return 0
  if (normA === normB) return 1
  return jaroWinkler(normA, normB)
}

/** Similaridade pra OFX-vs-Excel (Bug 1). Usa normalizeForMatch que strippa
 *  sufixos comerciais ("- Pagamento", "- Compra") pra alinhar com Excel
 *  que tem só "TOZZO ALIMENTOS LTDA". */
export function descriptionSimilarityForExcel(a: string, b: string): number {
  const normA = normalizeForMatch(a)
  const normB = normalizeForMatch(b)
  if (!normA || !normB) return 0
  if (normA === normB) return 1
  return jaroWinkler(normA, normB)
}

// ────────────────────────────────────────────────────────────────
// Core: match guloso 1:1
// ────────────────────────────────────────────────────────────────

interface BestMatch {
  candidate: ExistingCandidate
  similarity: number
  candidateIdx: number
}

/**
 * Acha o melhor candidato pra uma tx incoming, dentro de um filtro de prioridade
 * (origin/lifecycle). Retorna null se nenhum atende threshold.
 *
 * Critérios cumulativos:
 *   - amount ±R$ 0,02
 *   - data dentro da janela (varia por origin)
 *   - type igual (CRED↔CRED, DEBIT↔DEBIT)
 *   - bankAccount igual (exceto Excel PAYABLE, que não tem)
 *   - origin/lifecycle bate filtro
 *   - similaridade descrição ≥ threshold
 *   - NÃO claimed ainda neste import
 *
 * Tiebreak: maior similarity primeiro; em empate, candidato mais antigo (createdAt).
 * (Aqui ordenação é por índice no array — caller pode passar ordenado.)
 */
function findBestMatch(
  ofx: IncomingOfxTx,
  candidates: ExistingCandidate[],
  filter: {
    origin: ExistingCandidate['origin'] | Array<ExistingCandidate['origin']>
    lifecycle: ExistingCandidate['lifecycle'] | Array<ExistingCandidate['lifecycle']>
    requireSameBankAccount: boolean
    dateWindowDays: number
    /** Threshold mínimo de similaridade da descrição. Use 0 pra ignorar
     *  (casos MANUAL/Excel onde a descrição da contra-parte tem outra natureza
     *  — ex: OFX "PIX ENVIADO" vs MANUAL "YUSSEF - Transferência Pix"). */
    descriptionThreshold: number
  },
): BestMatch | null {
  const originSet = new Set(Array.isArray(filter.origin) ? filter.origin : [filter.origin])
  const lifecycleSet = new Set(Array.isArray(filter.lifecycle) ? filter.lifecycle : [filter.lifecycle])

  let best: BestMatch | null = null

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i]
    if (c.claimedInThisImport) continue
    if (!originSet.has(c.origin)) continue
    if (!lifecycleSet.has(c.lifecycle)) continue
    if (c.type !== ofx.type) continue
    if (!amountClose(c.amount, ofx.amount)) continue
    if (!dateWithinDays(c.date, ofx.date, filter.dateWindowDays)) continue
    if (filter.requireSameBankAccount && c.bankAccountId !== ofx.bankAccountId) continue

    // Pra Excel/RECEIVABLE usa similaridade que strippa sufixos comerciais.
    // Pra OFX/MANUAL usa a que preserva descrição operacional.
    const sim =
      c.origin === 'IMPORT_EXCEL'
        ? descriptionSimilarityForExcel(ofx.description, c.description)
        : descriptionSimilarity(ofx.description, c.description)
    if (sim < filter.descriptionThreshold) continue

    if (!best || sim > best.similarity) {
      best = { candidate: c, similarity: sim, candidateIdx: i }
    }
  }

  return best
}

/**
 * Classifica TODAS as txs incoming em ordem (guloso 1:1).
 *
 * Para cada incoming, tenta as 4 prioridades NA ORDEM:
 *   1. OFX EFFECTED existente → SKIP_DUP
 *   2. MANUAL EFFECTED sem link → REPLACE_MANUAL
 *   3. Excel PAYABLE → CONCILIATE_PAYABLE
 *   4. nada → CREATE_NEW
 *
 * Cada match faz "claim" do candidato (in-memory) pra que outra incoming não
 * o reuse. ZERO acesso a DB. ZERO mutação dos candidatos originais.
 */
export function findPreExistingMatches(input: FindMatchesInput): ClassifyResult[] {
  const threshold = input.descriptionThreshold ?? DEFAULT_DESC_THRESHOLD

  // Clona candidatos pra adicionar claimedInThisImport sem mutar o input
  const candidates: ExistingCandidate[] = input.candidates.map((c) => ({ ...c }))

  // Ordena incoming por index (preserva ordem do arquivo OFX)
  const incoming = [...input.incoming].sort((a, b) => a.index - b.index)

  const results: ClassifyResult[] = []

  for (const ofx of incoming) {
    // PRIORIDADE 1: já existe OFX (Bug 3 — FITID reciclado)
    // Descrição usa threshold (ex: 0.80) — OFX-vs-OFX devem ter descrição
    // similar (mesmo banco). Strippa números pra cobrir FITID reciclado.
    const dupOfx = findBestMatch(
      ofx,
      candidates,
      {
        origin: 'OFX',
        lifecycle: 'EFFECTED',
        requireSameBankAccount: true,
        dateWindowDays: DATE_WINDOW_DAYS.OFX,
        descriptionThreshold: threshold,
      },
    )
    if (dupOfx) {
      candidates[dupOfx.candidateIdx].claimedInThisImport = true
      results.push({
        ofxTxIndex: ofx.index,
        action: 'SKIP_DUP',
        matchedTxId: dupOfx.candidate.id,
        similarity: dupOfx.similarity,
        reason: 'já existe no sistema (provável re-import com FITID reciclado)',
      })
      continue
    }

    // PRIORIDADE 2: MANUAL provisória (Bug 2 — transferência manual lançada ontem)
    // Descrição NÃO entra como critério: OFX diz "PIX ENVIADO" e MANUAL tem
    // nome do recebedor — strings totalmente diferentes pra evento idêntico.
    // valor + data + conta exatos já são alta confiança.
    const manual = findBestMatch(
      ofx,
      candidates,
      {
        origin: 'MANUAL',
        lifecycle: 'EFFECTED',
        requireSameBankAccount: true,
        dateWindowDays: DATE_WINDOW_DAYS.MANUAL,
        descriptionThreshold: 0,  // ignora descrição (intencionalmente)
      },
    )
    if (manual && !manual.candidate.hasReconciledLink) {
      candidates[manual.candidateIdx].claimedInThisImport = true
      results.push({
        ofxTxIndex: ofx.index,
        action: 'REPLACE_MANUAL',
        matchedTxId: manual.candidate.id,
        similarity: manual.similarity,
        reason: 'substitui lançamento manual provisório',
      })
      continue
    }

    // PRIORIDADE 3: Excel PAYABLE esperando (Bug 1)
    // Descrição usa threshold parcial (0.5): Excel tem nome do fornecedor
    // ("TOZZO ALIMENTOS LTDA") e OFX tem "TOZZO ALIMENTOS LTDA - Pagamento" —
    // strippa sufixos comerciais, deve casar bem. Threshold mais baixo que
    // OFX-vs-OFX porque diferenças cosméticas (-/maiusculas) são comuns.
    const excelPayable = findBestMatch(
      ofx,
      candidates,
      {
        origin: 'IMPORT_EXCEL',
        lifecycle: ofx.type === 'CREDIT' ? 'RECEIVABLE' : 'PAYABLE',
        requireSameBankAccount: false,  // PAYABLE não tem bankAccount
        dateWindowDays: DATE_WINDOW_DAYS.IMPORT_EXCEL,
        descriptionThreshold: 0.5,
      },
    )
    if (excelPayable) {
      candidates[excelPayable.candidateIdx].claimedInThisImport = true
      results.push({
        ofxTxIndex: ofx.index,
        action: 'CONCILIATE_PAYABLE',
        matchedTxId: excelPayable.candidate.id,
        diff: ofx.amount - excelPayable.candidate.amount,
        similarity: excelPayable.similarity,
        reason: 'concilia com conta a pagar Excel pendente',
      })
      continue
    }

    // PRIORIDADE 4: nada acha → cria nova
    results.push({
      ofxTxIndex: ofx.index,
      action: 'CREATE_NEW',
      reason: 'genuinamente nova',
    })
  }

  return results
}
