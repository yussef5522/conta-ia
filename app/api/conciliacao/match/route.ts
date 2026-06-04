// Sprint 4.0.2 + Sprint A-fix (03/06/2026) — POST /api/conciliacao/match
// Recebe ofxTransactionId, retorna candidatos PAYABLE/RECEIVABLE rankeados.
//
// Sprint A-fix: response inclui candidate metadata embarcado em cada match,
// pra UI renderizar direto sem precisar de GET /api/transacoes/[id] por
// candidato (que retorna 422 quando bankAccountId IS NULL — caso típico de
// PAYABLE/Manual). Elimina N+1 fetch e o bug "candidatos vazios na tela".

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { rankCandidates, classifyRecommendation } from '@/lib/conciliacao/match'
import { findReconciliationCandidates } from '@/lib/conciliacao/find-candidates'

const matchBodySchema = z.object({
  ofxTransactionId: z.string().cuid(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = matchBodySchema.parse(body)

    const ofxTx = await prisma.transaction.findUnique({
      where: { id: data.ofxTransactionId },
      include: { bankAccount: { select: { companyId: true } } },
    })
    if (!ofxTx || !ofxTx.bankAccount) {
      return NextResponse.json({ erro: 'Transação OFX não encontrada' }, { status: 404 })
    }
    if (ofxTx.lifecycle !== 'EFFECTED' || !ofxTx.bankAccountId) {
      return NextResponse.json(
        { erro: 'Tx precisa ser EFFECTED com bankAccount válido' },
        { status: 422 },
      )
    }
    if (ofxTx.reconciledWithId) {
      return NextResponse.json(
        { erro: 'Tx OFX já está conciliada' },
        { status: 422 },
      )
    }

    const companyId = ofxTx.bankAccount.companyId
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.view')

    const ofx = {
      id: ofxTx.id,
      description: ofxTx.description,
      amount: ofxTx.amount,
      type: ofxTx.type as 'CREDIT' | 'DEBIT',
      date: ofxTx.date,
      supplierId: ofxTx.supplierId,
      bankAccountId: ofxTx.bankAccountId,
    }

    const candidates = await findReconciliationCandidates(ofx, companyId)
    const matches = rankCandidates(ofx, candidates)
    const topScore = matches[0]?.score ?? 0
    const recommendation = classifyRecommendation(topScore)

    // Sprint A-fix: embarca metadata do candidato em cada match (lookup O(1) por
    // id, mantendo a ordem do rankCandidates). Evita N+1 do client e o bug do
    // GET /api/transacoes/[id] retornar 422 pra candidatos sem bankAccount.
    const candidateById = new Map(candidates.map((c) => [c.id, c]))
    const enrichedMatches = matches.map((m) => {
      const c = candidateById.get(m.candidateId)
      return {
        ...m,
        candidate: c
          ? {
              id: c.id,
              description: c.description,
              amount: c.amount,
              dueDate: c.dueDate.toISOString(),
              lifecycle: c.lifecycle,
            }
          : null,
      }
    })

    return NextResponse.json({
      ofxTransaction: {
        id: ofxTx.id,
        description: ofxTx.description,
        amount: ofxTx.amount,
        date: ofxTx.date,
        type: ofxTx.type,
      },
      matches: enrichedMatches,
      recommendation,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
