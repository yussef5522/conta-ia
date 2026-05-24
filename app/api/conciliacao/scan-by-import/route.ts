// Sprint 4.0.2 — POST /api/conciliacao/scan-by-import
// Body: { importId } — escaneia todas as tx OFX de um import e retorna sugestões.
// Usado pelo wizard pós-OFX.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import {
  rankCandidates,
  classifyRecommendation,
  type MatchScore,
  type MatchRecommendation,
} from '@/lib/conciliacao/match'
import { findReconciliationCandidates } from '@/lib/conciliacao/find-candidates'
import { applyHybridBoost } from '@/lib/conciliacao/claude-judge'

const scanSchema = z.object({
  importId: z.string().cuid(),
})

export interface ScanSuggestion {
  ofxTransaction: {
    id: string
    description: string
    amount: number
    date: Date
    type: string
  }
  topMatch: MatchScore & {
    candidate: {
      id: string
      description: string
      amount: number
      dueDate: Date | null
      lifecycle: string
    }
  }
  recommendation: MatchRecommendation
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { importId } = scanSchema.parse(body)

    const importInfo = await prisma.ofxImport.findUnique({
      where: { id: importId },
      select: { bankAccount: { select: { companyId: true } } },
    })
    if (!importInfo) {
      return NextResponse.json({ erro: 'Import não encontrado' }, { status: 404 })
    }
    const companyId = importInfo.bankAccount.companyId

    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.view')

    const ofxTxs = await prisma.transaction.findMany({
      where: {
        importId,
        lifecycle: 'EFFECTED',
        reconciledWithId: null,
      },
      select: {
        id: true,
        description: true,
        amount: true,
        type: true,
        date: true,
        supplierId: true,
        bankAccountId: true,
      },
    })

    const limited = ofxTxs.slice(0, 100)
    const suggestions: ScanSuggestion[] = []

    for (const ofxTx of limited) {
      if (!ofxTx.bankAccountId) continue
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
      if (candidates.length === 0) continue
      const matches = rankCandidates(ofx, candidates)
      let top = matches[0]
      if (!top) continue

      // Sprint 4.0.4 — Match híbrido AUTO no scan:
      // Se score determinístico está na faixa cinzenta (50-69), pede boost
      // semântico ao Claude Haiku. Cache 24h em AiClaudeCache evita custo
      // recorrente. Fora dessa faixa, retorna o score original sem chamar IA.
      const candForBoost = candidates.find((c) => c.id === top.candidateId)
      if (candForBoost) {
        top = await applyHybridBoost(top, ofx, candForBoost, companyId)
      }

      const recommendation = classifyRecommendation(top.score)
      if (recommendation === 'NO_MATCH') continue

      const cand = candidates.find((c) => c.id === top.candidateId)
      if (!cand) continue

      suggestions.push({
        ofxTransaction: {
          id: ofxTx.id,
          description: ofxTx.description,
          amount: ofxTx.amount,
          date: ofxTx.date,
          type: ofxTx.type,
        },
        topMatch: {
          ...top,
          candidate: {
            id: cand.id,
            description: cand.description,
            amount: cand.amount,
            dueDate: cand.dueDate,
            lifecycle: cand.lifecycle,
          },
        },
        recommendation,
      })
    }

    return NextResponse.json({
      suggestions,
      totalOfxScanned: limited.length,
      ofxRemaining: ofxTxs.length - limited.length,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
