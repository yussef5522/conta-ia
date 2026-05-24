// Sprint 4.0.2 — POST /api/conciliacao/confirmar
// Body: { ofxTransactionId, candidateId }
// Aplica a conciliação atomic (PAYABLE/RECEIVABLE → EFFECTED + link).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import {
  reconcileTransactions,
  ReconciliationError,
} from '@/lib/conciliacao/reconcile'

const confirmarSchema = z.object({
  ofxTransactionId: z.string().cuid(),
  candidateId: z.string().cuid(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = confirmarSchema.parse(body)

    // Resolve companyId via OFX pra criar contexto
    const ofxTx = await prisma.transaction.findUnique({
      where: { id: data.ofxTransactionId },
      select: { bankAccount: { select: { companyId: true } } },
    })
    if (!ofxTx || !ofxTx.bankAccount) {
      return NextResponse.json({ erro: 'Transação OFX não encontrada' }, { status: 404 })
    }

    const ctx = await getAuthContext(request, ofxTx.bankAccount.companyId)
    ctx.requirePermission('transaction.update')

    const result = await reconcileTransactions(data, ctx)
    return NextResponse.json({ ok: true, candidate: result.candidate })
  } catch (error) {
    if (error instanceof ReconciliationError) {
      return NextResponse.json({ erro: error.reason }, { status: error.status })
    }
    return handleApiError(error)
  }
}
