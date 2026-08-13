// Sprint 5.0.2.t — POST /apply-active-transfers
// Aplica seleção do user após /detect-active-transfers/preview.
// Body: { pairs: [{ debitId, creditId, confidence?, matchType? }] }

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { applyTransferCandidate } from '@/lib/conciliation/active-transfer-detector'
import { recordConfirmed, recordIgnored } from '@/lib/transfers/suggestion-events'

const schema = z.object({
  pairs: z
    .array(
      z.object({
        debitId: z.string().cuid(),
        creditId: z.string().cuid(),
        confidence: z.number().min(0).max(1).optional(),
        matchType: z
          .enum(['EXACT_SAME_DAY', 'EXACT_ADJACENT', 'WITHIN_3DAYS'])
          .optional(),
      }),
    )
    .max(500),
  // Sprint TransferSuggestionEvent (13/08): pares que o usuário IGNOROU no modal
  // → registrados IGNORED (não voltam ao banner).
  ignored: z
    .array(z.object({ debitId: z.string().cuid(), creditId: z.string().cuid() }))
    .max(500)
    .optional(),
})

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.update')

    const { pairs, ignored } = schema.parse(await request.json())

    // Registra os IGNORADOS (não bloqueia o resto) — não voltam ao banner.
    if (ignored && ignored.length > 0) {
      await recordIgnored(
        prisma,
        companyId,
        ignored.map((p) => ({ debitTxId: p.debitId, creditTxId: p.creditId })),
      )
    }

    if (pairs.length === 0) {
      return NextResponse.json({ aplicadas: 0, ignored: ignored?.length ?? 0 })
    }

    // Defesa multi-tenant: pega txs e checa ownership em 1 query
    const ids = Array.from(
      new Set(pairs.flatMap((p) => [p.debitId, p.creditId])),
    )
    const owned = await prisma.transaction.findMany({
      where: {
        id: { in: ids },
        bankAccount: { companyId },
      },
      select: {
        id: true,
        type: true,
        amount: true,
        date: true,
        paymentDate: true,
        description: true,
        bankAccountId: true,
      },
    })
    const ownedMap = new Map(owned.map((t) => [t.id, t]))

    let aplicadas = 0
    const errors: string[] = []
    const confirmed: Array<{ debitTxId: string; creditTxId: string; confidence: number }> = []
    for (const pair of pairs) {
      const d = ownedMap.get(pair.debitId)
      const c = ownedMap.get(pair.creditId)
      if (!d || !c) {
        errors.push(`pair ${pair.debitId}/${pair.creditId}: tx não pertence à empresa`)
        continue
      }
      if (d.type !== 'DEBIT' || c.type !== 'CREDIT') {
        errors.push(`pair ${pair.debitId}/${pair.creditId}: tipos invertidos`)
        continue
      }
      if (d.amount !== c.amount) {
        errors.push(`pair ${pair.debitId}/${pair.creditId}: valores não batem`)
        continue
      }
      if (d.bankAccountId === c.bankAccountId) {
        errors.push(`pair ${pair.debitId}/${pair.creditId}: mesma conta`)
        continue
      }

      await applyTransferCandidate({
        debit: { ...d },
        credit: { ...c },
        confidence: pair.confidence ?? 0.85,
        matchType: pair.matchType ?? 'WITHIN_3DAYS',
        daysApart: 0,
      })
      confirmed.push({ debitTxId: pair.debitId, creditTxId: pair.creditId, confidence: pair.confidence ?? 0.85 })
      aplicadas++
    }

    // CONFIRMED: se havia SUGGESTED (unified) → o motor acertou; senão manual.
    if (confirmed.length > 0) await recordConfirmed(prisma, companyId, confirmed)

    return NextResponse.json({ aplicadas, errors, ignored: ignored?.length ?? 0 })
  } catch (error) {
    return handleApiError(error)
  }
}
