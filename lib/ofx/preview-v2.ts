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
}

export function buildV2PreviewPayload(input: {
  novas: Array<OFXTransaction & { dedupHash: string }>
  totalArquivo: number
  duplicadasHashLegado: number
  errosParser: string[]
  banco: BancoDetectadoPayload | null
  contaId: string
  candidates: CandidateWithMeta[]
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
  }
}

/** Helper pra UI/callers: feature flag ligada? */
export function isV2PreviewEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.IMPORT_PREVIEW_V2 === 'true'
}

/** Re-export para testes */
export type { ClassifyResult }
