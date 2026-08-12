// Sprint 5.0.2.t — POST /detect-active-transfers
// Preview de candidatos a transferência interna cross-conta.
// Body opcional: { daysWindow?: number, minAmount?: number, autoApply?: boolean }
// Quando autoApply=true, aplica TODOS com confidence ≥ 0.85.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import {
  findActiveTransferCandidates,
  applyTransferCandidate,
} from '@/lib/conciliation/active-transfer-detector'
import { isUnifiedTransferEnabled } from '@/lib/transfers/unified-transfer-flag'
import { detectTransfersForCompany } from '@/lib/transfers/detect-transfers-for-company'

const schema = z.object({
  daysWindow: z.number().int().min(0).max(15).optional(),
  minAmount: z.number().nonnegative().optional(),
  autoApply: z.boolean().optional(),
  /** Confidence threshold pra auto-aplicar (default 0.85). */
  autoApplyMinConfidence: z.number().min(0).max(1).optional(),
})

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.update')

    const body = await request.json().catch(() => ({}))
    const input = schema.parse(body)

    // ── FASE 4 (10/08): MOTOR ÚNICO atrás de flag. Tela 1 (banner Pendentes).
    // Rollback = desligar UNIFIED_TRANSFER_ENGINE. Fonte única compartilhada
    // com as próximas telas (detectTransfersForCompany) → não discordam.
    if (isUnifiedTransferEnabled()) {
      const { suggestions } = await detectTransfersForCompany(companyId, { matchOwnerName: true })
      let appliedU = 0
      if (input.autoApply) {
        const threshold = input.autoApplyMinConfidence ?? 0.85
        for (const s of suggestions) {
          if (s.confidence < threshold) continue
          await applyTransferCandidate({
            debit: { id: s.from.id, description: s.from.description, date: s.from.date, paymentDate: null, amount: s.from.amount, bankAccountId: s.from.bankAccountId },
            credit: { id: s.to.id, description: s.to.description, date: s.to.date, paymentDate: null, amount: s.to.amount, bankAccountId: s.to.bankAccountId },
            confidence: s.confidence,
            matchType: 'EXACT_SAME_DAY',
            daysApart: s.deltaDays,
          })
          appliedU++
        }
      }
      console.log(`[DETECT-ACTIVE-TRANSFERS unified] company=${companyId} suggestions=${suggestions.length} applied=${appliedU}`)
      return NextResponse.json({
        engine: 'unified',
        candidates: suggestions.map((s) => ({
          debit: { id: s.from.id, description: s.from.description, date: s.from.date, amount: s.from.amount, bankAccountId: s.from.bankAccountId, bankAccountName: s.from.bankAccountName ?? null },
          credit: { id: s.to.id, description: s.to.description, date: s.to.date, amount: s.to.amount, bankAccountId: s.to.bankAccountId, bankAccountName: s.to.bankAccountName ?? null },
          confidence: s.confidence,
          matchType: s.deltaDays === 0 ? 'EXACT_SAME_DAY' : s.deltaDays === 1 ? 'EXACT_ADJACENT' : 'WITHIN_3DAYS',
          daysApart: s.deltaDays,
          // Explicabilidade na TELA (não só log): por que foi sugerido.
          layer: s.layer,
          evidences: s.evidences,
          signals: s.signals,
        })),
        total: suggestions.length,
        applied: appliedU,
      })
    }

    const candidates = await findActiveTransferCandidates(companyId, {
      daysWindow: input.daysWindow,
      minAmount: input.minAmount,
    })

    let applied = 0
    if (input.autoApply) {
      const threshold = input.autoApplyMinConfidence ?? 0.85
      for (const c of candidates) {
        if (c.confidence >= threshold) {
          await applyTransferCandidate(c)
          applied++
        }
      }
    }

    console.log(
      `[DETECT-ACTIVE-TRANSFERS] company=${companyId} candidates=${candidates.length} ` +
        `applied=${applied} autoApply=${!!input.autoApply}`,
    )

    return NextResponse.json({
      candidates: candidates.map((c) => ({
        debit: {
          id: c.debit.id,
          description: c.debit.description,
          date: c.debit.paymentDate ?? c.debit.date,
          amount: c.debit.amount,
          bankAccountId: c.debit.bankAccountId,
          bankAccountName: c.debit.bankAccountName ?? null,
        },
        credit: {
          id: c.credit.id,
          description: c.credit.description,
          date: c.credit.paymentDate ?? c.credit.date,
          amount: c.credit.amount,
          bankAccountId: c.credit.bankAccountId,
          bankAccountName: c.credit.bankAccountName ?? null,
        },
        confidence: c.confidence,
        matchType: c.matchType,
        daysApart: c.daysApart,
      })),
      total: candidates.length,
      applied,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
