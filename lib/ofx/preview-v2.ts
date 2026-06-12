// Sprint 3-Bugs Fase 2A (Yussef 12/06/2026) — Payload do preview do import OFX.
//
// Extrai a lógica de montar o payload do preview pra função PURA testável.
// Tem 2 versões:
//   - buildLegacyPreviewPayload: payload IDÊNTICO ao histórico (flag V2=false).
//     Pra não quebrar o fluxo de import atual.
//   - buildV2PreviewPayload: payload enriquecido com classificação 4-grupos
//     (skipDup / replaceManual / conciliatePayable / novasGenuinas).
//
// Ambas FUNÇÕES PURAS — recebem dados, retornam objeto serializável. ZERO
// acesso a DB. Quem faz IO é o route handler.

import type { OFXTransaction } from './parser'
import {
  findPreExistingMatches,
  normalizeUTC,
  type IncomingOfxTx,
  type ExistingCandidate,
  type ClassifyResult,
} from '@/lib/conciliacao/find-pre-existing-matches'

// ───────────────────────────────────────────────────────────────
// Payload LEGADO (preservado bit-pra-bit)
// ───────────────────────────────────────────────────────────────

export interface LegacyPreviewItem {
  fitid: string
  dedupHash: string
  date: Date
  amount: number
  type: 'CREDIT' | 'DEBIT'
  memo: string
}

export interface LegacyPreviewPayload {
  preview: LegacyPreviewItem[]
  total: number
  novas: number
  duplicadas: number
  errosParser: string[]
  banco: BancoDetectadoPayload | null
}

export interface BancoDetectadoPayload {
  codigo: string
  nome: string
  /** null quando não há perfil de conta suficiente pra comparar */
  batePerfilConta: boolean | null
}

export function buildLegacyPreviewPayload(input: {
  novas: Array<OFXTransaction & { dedupHash: string }>
  totalArquivo: number
  duplicadas: number
  errosParser: string[]
  banco: BancoDetectadoPayload | null
}): LegacyPreviewPayload {
  return {
    preview: input.novas.map((t) => ({
      fitid: t.fitid,
      dedupHash: t.dedupHash,
      date: t.datePosted,
      amount: t.amount,
      type: t.type,
      memo: t.memo,
    })),
    total: input.totalArquivo,
    novas: input.novas.length,
    duplicadas: input.duplicadas,
    errosParser: input.errosParser,
    banco: input.banco,
  }
}

// ───────────────────────────────────────────────────────────────
// Payload V2 — enriquecido com classificação 4-grupos
// ───────────────────────────────────────────────────────────────

interface CandidateWithMeta {
  id: string
  bankAccountId: string | null
  amount: number
  date: Date
  dueDate: Date | null
  description: string
  type: string
  origin: string
  lifecycle: string
  reconciledWithId: string | null
  transferGroupId: string | null
  category: { name: string } | null
  supplier: { razaoSocial: string } | null
}

export interface V2BaseItem {
  ofxIndex: number
  amount: number
  date: string  // ISO
  memo: string
  type: 'CREDIT' | 'DEBIT'
}

export interface V2SkipDupItem extends V2BaseItem {
  matchedTxId: string
  matchedAmount: number
  matchedDate: string
  matchedDescription: string
  matchedOrigin: 'OFX'
  similarity: number
  reason: string
}

export interface V2ReplaceManualItem extends V2BaseItem {
  matchedTxId: string
  matchedAmount: number
  matchedDate: string
  matchedDescription: string
  matchedOrigin: 'MANUAL'
  isTransferGroup: boolean
  transferGroupId: string | null
  similarity: number
  reason: string
}

export interface V2ConciliatePayableItem extends V2BaseItem {
  matchedTxId: string
  matchedAmount: number
  matchedDate: string
  matchedDescription: string
  matchedOrigin: 'IMPORT_EXCEL'
  matchedCategoryName: string | null
  matchedSupplierName: string | null
  diff: number
  similarity: number
  reason: string
}

export interface V2NovaGenuinaItem extends V2BaseItem {
  fitid: string
  dedupHash: string
}

/** Hipótese sobre causa de divergência LEDGERBAL ≠ saldoPos (Sub-fase 2B). */
export type LedgerBalHipoteseTipo =
  | 'dup_marcada_nova'        // alguma nova é dup escondida
  | 'real_marcada_dup'        // alguma marcada como dup era real
  | 'historico_errado'        // balance pré-existente diverge do banco

export interface LedgerBalHipotese {
  tipo: LedgerBalHipoteseTipo
  label: string
  /** Indica a "mais provável" — pra UI destacar */
  maisProvavel: boolean
  /** ofxIndex que casam exatos com diff (quando aplicável) */
  suspeitos?: number[]
}

export interface LedgerBalCheckPayload {
  /** Dados do extrato */
  ledgerBalAmount: number | null
  ledgerBalDate: string | null     // ISO
  /** Dado do sistema */
  balanceAtual: number
  /** Cálculo do delta */
  deltaImportProposto: number
  saldoPosImport: number
  /** Verdict */
  available: boolean               // false se ledgerBalAmount=null
  bate: boolean                    // true se |LEDGERBAL - saldoPos| ≤ 0.02
  diff: number                     // LEDGERBAL - saldoPos
  /** Pro UI explicar quando não bate (vazio quando bate) */
  hipoteses: LedgerBalHipotese[]
}

export interface V2PreviewPayload {
  banco: BancoDetectadoPayload | null
  total: number
  errosParser: string[]
  duplicadasHashLegado: number
  classificacao: {
    skipDup: V2SkipDupItem[]
    replaceManual: V2ReplaceManualItem[]
    conciliatePayable: V2ConciliatePayableItem[]
    novasGenuinas: V2NovaGenuinaItem[]
    contagens: {
      total: number
      skipDup: number
      replaceManual: number
      conciliatePayable: number
      novasGenuinas: number
      duplicadasHashLegado: number
    }
  }
  ledgerBalCheck: LedgerBalCheckPayload
}

// ───────────────────────────────────────────────────────────────
// LedgerBalCheck (Sub-fase 2B) — função pura
// ───────────────────────────────────────────────────────────────

const LEDGER_BAL_TOLERANCE = 0.02

/** Signed amount pra cálculo do delta:
 *  CREDIT (+amount) — entrada de dinheiro
 *  DEBIT  (-amount) — saída de dinheiro */
function signedAmount(item: { type: 'CREDIT' | 'DEBIT'; amount: number }): number {
  return item.type === 'CREDIT' ? item.amount : -item.amount
}

/** Constrói o LedgerBalCheck a partir do estado atual + classificação.
 *
 *  SKIP_DUP e REPLACE_MANUAL NÃO entram no delta (já estavam contados no
 *  balance). Apenas novasGenuinas + CONCILIATE_PAYABLE (que cria saída real)
 *  contribuem pro delta. */
export function buildLedgerBalCheck(input: {
  ledgerBalance: { amount: number; asOfDate: Date } | null
  balanceAtual: number
  novasGenuinas: V2NovaGenuinaItem[]
  conciliatePayable: V2ConciliatePayableItem[]
}): LedgerBalCheckPayload {
  const deltaNovas = input.novasGenuinas.reduce((s, t) => s + signedAmount(t), 0)
  const deltaConcil = input.conciliatePayable.reduce((s, t) => s + signedAmount(t), 0)
  const deltaImportProposto = deltaNovas + deltaConcil
  const saldoPosImport = input.balanceAtual + deltaImportProposto

  // Sem LEDGERBAL no arquivo: verificação indisponível
  if (input.ledgerBalance === null) {
    return {
      ledgerBalAmount: null,
      ledgerBalDate: null,
      balanceAtual: input.balanceAtual,
      deltaImportProposto,
      saldoPosImport,
      available: false,
      bate: false,
      diff: 0,
      hipoteses: [],
    }
  }

  const diff = input.ledgerBalance.amount - saldoPosImport
  const bate = Math.abs(diff) <= LEDGER_BAL_TOLERANCE

  // Quando bate: nenhuma hipótese
  if (bate) {
    return {
      ledgerBalAmount: input.ledgerBalance.amount,
      ledgerBalDate: input.ledgerBalance.asOfDate.toISOString(),
      balanceAtual: input.balanceAtual,
      deltaImportProposto,
      saldoPosImport,
      available: true,
      bate: true,
      diff: 0,
      hipoteses: [],
    }
  }

  // Quando NÃO bate: lista as 3 hipóteses + identifica a mais provável
  // Sinal do diff:
  //   diff > 0 (LEDGERBAL > saldoPos) → banco tem MAIS saldo que sistema
  //     → falta entrada que sistema marcou como dup, ou tem saída a mais
  //   diff < 0 (LEDGERBAL < saldoPos) → banco tem MENOS saldo que sistema
  //     → sistema tem entrada falsa (algo marcado como nova que era dup),
  //       ou falta saída
  const suspeitosNovas = input.novasGenuinas
    .filter((t) => Math.abs(Math.abs(signedAmount(t)) - Math.abs(diff)) <= LEDGER_BAL_TOLERANCE)
    .map((t) => t.ofxIndex)

  // Heurística "mais provável":
  //   Se algum item nas novasGenuinas casa exato com |diff| → hipótese 1
  //   Caso contrário → hipótese 3 (histórico errado) é o palpite default
  const hasSuspeitoNova = suspeitosNovas.length > 0

  const hipoteses: LedgerBalHipotese[] = [
    {
      tipo: 'dup_marcada_nova',
      label: 'Alguma transação marcada como nova é, na verdade, duplicata (vai contar 2×).',
      maisProvavel: hasSuspeitoNova,
      suspeitos: hasSuspeitoNova ? suspeitosNovas : undefined,
    },
    {
      tipo: 'real_marcada_dup',
      label: 'Alguma transação marcada como "já no sistema" era real (faltando no balance).',
      maisProvavel: false,
    },
    {
      tipo: 'historico_errado',
      label: 'Balance pré-existente diverge do banco (estrago histórico não relacionado a este import).',
      maisProvavel: !hasSuspeitoNova,
    },
  ]

  return {
    ledgerBalAmount: input.ledgerBalance.amount,
    ledgerBalDate: input.ledgerBalance.asOfDate.toISOString(),
    balanceAtual: input.balanceAtual,
    deltaImportProposto,
    saldoPosImport,
    available: true,
    bate: false,
    diff,
    hipoteses,
  }
}

export function buildV2PreviewPayload(input: {
  novas: Array<OFXTransaction & { dedupHash: string }>
  totalArquivo: number
  duplicadasHashLegado: number
  errosParser: string[]
  banco: BancoDetectadoPayload | null
  contaId: string
  candidates: CandidateWithMeta[]
  /** NOVO 2B — balance atual da conta (pra LedgerBalCheck) */
  contaBalance?: number
  /** NOVO 2B — LEDGERBAL extraído do OFX (pode ser null) */
  ledgerBalance?: { amount: number; asOfDate: Date } | null
}): V2PreviewPayload {
  // 1. Mapeia novas pra IncomingOfxTx
  const incoming: IncomingOfxTx[] = input.novas.map((t, index) => ({
    index,
    bankAccountId: input.contaId,
    amount: t.amount,
    date: normalizeUTC(t.datePosted),
    description: t.memo,
    type: t.type,
  }))

  // 2. Mapeia candidates pra ExistingCandidate
  const candidates: ExistingCandidate[] = input.candidates
    .map((c) => {
      const origin = c.origin as 'OFX' | 'MANUAL' | 'IMPORT_EXCEL' | 'ADJUSTMENT'
      const lifecycle = c.lifecycle as 'EFFECTED' | 'PAYABLE' | 'RECEIVABLE'
      // TRANSFER manual exporta como DEBIT no extrato real (banco emite saída).
      // Pra match contra OFX, normaliza type da perna manual de TRANSFER.
      const type: 'CREDIT' | 'DEBIT' =
        c.type === 'TRANSFER' ? 'DEBIT' : (c.type as 'CREDIT' | 'DEBIT')
      return {
        id: c.id,
        bankAccountId: c.bankAccountId,
        amount: c.amount,
        date: normalizeUTC(c.dueDate ?? c.date),
        description: c.description,
        type,
        origin,
        lifecycle,
        hasReconciledLink: c.reconciledWithId !== null,
      }
    })

  // 3. Classifica (função pura)
  const results = findPreExistingMatches({ incoming, candidates })

  // 4. Indexa pra lookup rápido
  const candidatesById = new Map(input.candidates.map((c) => [c.id, c]))

  // 5. Agrupa por action
  const skipDup: V2SkipDupItem[] = []
  const replaceManual: V2ReplaceManualItem[] = []
  const conciliatePayable: V2ConciliatePayableItem[] = []
  const novasGenuinas: V2NovaGenuinaItem[] = []

  for (const r of results) {
    const ofx = input.novas[r.ofxTxIndex]
    const base: V2BaseItem = {
      ofxIndex: r.ofxTxIndex,
      amount: ofx.amount,
      date: ofx.datePosted.toISOString(),
      memo: ofx.memo,
      type: ofx.type,
    }
    if (r.action === 'SKIP_DUP') {
      const matched = r.matchedTxId ? candidatesById.get(r.matchedTxId) : undefined
      if (!matched) continue
      skipDup.push({
        ...base,
        matchedTxId: matched.id,
        matchedAmount: matched.amount,
        matchedDate: matched.date.toISOString(),
        matchedDescription: matched.description,
        matchedOrigin: 'OFX',
        similarity: r.similarity ?? 0,
        reason: r.reason,
      })
    } else if (r.action === 'REPLACE_MANUAL') {
      const matched = r.matchedTxId ? candidatesById.get(r.matchedTxId) : undefined
      if (!matched) continue
      replaceManual.push({
        ...base,
        matchedTxId: matched.id,
        matchedAmount: matched.amount,
        matchedDate: matched.date.toISOString(),
        matchedDescription: matched.description,
        matchedOrigin: 'MANUAL',
        isTransferGroup: matched.transferGroupId !== null,
        transferGroupId: matched.transferGroupId,
        similarity: r.similarity ?? 0,
        reason: r.reason,
      })
    } else if (r.action === 'CONCILIATE_PAYABLE') {
      const matched = r.matchedTxId ? candidatesById.get(r.matchedTxId) : undefined
      if (!matched) continue
      conciliatePayable.push({
        ...base,
        matchedTxId: matched.id,
        matchedAmount: matched.amount,
        matchedDate: (matched.dueDate ?? matched.date).toISOString(),
        matchedDescription: matched.description,
        matchedOrigin: 'IMPORT_EXCEL',
        matchedCategoryName: matched.category?.name ?? null,
        matchedSupplierName: matched.supplier?.razaoSocial ?? null,
        diff: r.diff ?? 0,
        similarity: r.similarity ?? 0,
        reason: r.reason,
      })
    } else {
      // CREATE_NEW
      novasGenuinas.push({
        ...base,
        fitid: ofx.fitid,
        dedupHash: ofx.dedupHash,
      })
    }
  }

  const ledgerBalCheck = buildLedgerBalCheck({
    ledgerBalance: input.ledgerBalance ?? null,
    balanceAtual: input.contaBalance ?? 0,
    novasGenuinas,
    conciliatePayable,
  })

  return {
    banco: input.banco,
    total: input.totalArquivo,
    errosParser: input.errosParser,
    duplicadasHashLegado: input.duplicadasHashLegado,
    classificacao: {
      skipDup,
      replaceManual,
      conciliatePayable,
      novasGenuinas,
      contagens: {
        total: input.totalArquivo,
        skipDup: skipDup.length,
        replaceManual: replaceManual.length,
        conciliatePayable: conciliatePayable.length,
        novasGenuinas: novasGenuinas.length,
        duplicadasHashLegado: input.duplicadasHashLegado,
      },
    },
    ledgerBalCheck,
  }
}

/** Helper pra UI/callers: feature flag ligada? */
export function isV2PreviewEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.IMPORT_PREVIEW_V2 === 'true'
}

/** Re-export para testes */
export type { ClassifyResult }
