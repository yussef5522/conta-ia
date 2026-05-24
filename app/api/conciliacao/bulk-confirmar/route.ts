// Sprint 4.0.2 — POST /api/conciliacao/bulk-confirmar
// Body: { pairs: [{ ofxTransactionId, candidateId }, ...] }
// Aplica N conciliações em sequência (não-atomic globalmente — cada par é atomic).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import {
  reconcileTransactions,
  ReconciliationError,
} from '@/lib/conciliacao/reconcile'

const bulkSchema = z.object({
  pairs: z
    .array(
      z.object({
        ofxTransactionId: z.string().cuid(),
        candidateId: z.string().cuid(),
      }),
    )
    .min(1)
    .max(100),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = bulkSchema.parse(body)

    // Resolve companyId pelo primeiro OFX (todos devem ser da mesma empresa —
    // se houver pares cross-empresa, cada reconcileTransactions rejeita)
    const firstOfx = await prisma.transaction.findUnique({
      where: { id: data.pairs[0].ofxTransactionId },
      select: { bankAccount: { select: { companyId: true } } },
    })
    if (!firstOfx?.bankAccount) {
      return NextResponse.json({ erro: 'Tx OFX primária não encontrada' }, { status: 404 })
    }

    const ctx = await getAuthContext(request, firstOfx.bankAccount.companyId)
    ctx.requirePermission('transaction.update')

    let reconciled = 0
    let failed = 0
    const errors: Array<{ pair: { ofxTransactionId: string; candidateId: string }; error: string }> = []

    for (const pair of data.pairs) {
      try {
        await reconcileTransactions(pair, ctx)
        reconciled++
      } catch (e) {
        failed++
        errors.push({
          pair,
          error: e instanceof ReconciliationError ? e.reason : 'Erro desconhecido',
        })
      }
    }

    return NextResponse.json({ ok: true, reconciled, failed, errors })
  } catch (error) {
    return handleApiError(error)
  }
}
