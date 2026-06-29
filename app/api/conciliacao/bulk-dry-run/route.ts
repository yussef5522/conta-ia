// Sprint A-effected Fase 2 — GET /api/conciliacao/bulk-dry-run
//
// Lista pares OFX↔candidato com top-match acima de minScore, SEM aplicar
// nenhuma conciliação. UI consome pra renderizar tabela de revisão antes
// do bulk-confirmar.
//
// Pra cada tx OFX EFFECTED não conciliada da empresa:
//   1) Roda findReconciliationCandidates (Sprint A: ramo 1 PAYABLE +
//      ramo 2 EFFECTED órfão)
//   2) Roda rankCandidates → score por valor + data + supplier + descrição
//   3) Filtra: top match com score ≥ minScore (default 90)
//   4) Retorna metadata embarcada (sem N+1 no client)
//
// Default minScore=90 (AUTO_RECONCILE — coerente com bulk só pra alta
// confiança decidido na Fase 1).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { findReconciliationCandidates } from '@/lib/conciliacao/find-candidates'
import { rankCandidates } from '@/lib/conciliacao/match'
import { getTipoFilter, parseTipoParam } from '@/lib/conciliacao/tipo-filter'
import { NEEDS_REVIEW_WHERE_PRISMA } from '@/lib/transacoes/needs-review'

const querySchema = z.object({
  empresaId: z.string().cuid(),
  minScore: z.coerce.number().int().min(0).max(100).default(90),
  // Sprint A-effected Fase A — filtro por tipo (default todos)
  tipo: z.string().optional(),
  // Cap defensivo: evita varrer 10k tx OFX e estourar tempo
  limit: z.coerce.number().int().min(1).max(500).default(200),
})

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const data = querySchema.parse(Object.fromEntries(url.searchParams))

    const ctx = await getAuthContext(request, data.empresaId)
    ctx.requirePermission('transaction.view')

    // Tx OFX candidatas (não conciliadas, EFFECTED, da empresa).
    // Filtra DOIS sentidos do link:
    //   - reconciledWithId IS NULL: OFX não aponta pra ninguém (sempre verdade
    //     pra OFX porque link é unidirecional Excel→OFX, mas defesa em profundidade)
    //   - reconciledFrom NONE: nenhuma Excel/Manual aponta PRA esta OFX
    //     ↪ Resolve caso Lamana: Excel #1 já conciliada com OFX → Excel #2 órfã
    //     não deve achar essa OFX como candidata.
    const tipo = parseTipoParam(data.tipo)
    const tipoFilter = getTipoFilter(tipo)

    const ofxTxs = await prisma.transaction.findMany({
      where: {
        // Sprint Fundação Status (28/06/2026): FONTE DE VERDADE ÚNICA.
        ...NEEDS_REVIEW_WHERE_PRISMA,
        // Filtros específicos do bulk-dry-run (OFX/EFFECTED + cashCoded):
        origin: 'OFX',
        lifecycle: 'EFFECTED',
        cashCoded: false,
        bankAccount: { companyId: data.empresaId },
        ...tipoFilter,
      },
      select: {
        id: true,
        description: true,
        amount: true,
        date: true,
        type: true,
        supplierId: true,
        bankAccountId: true,
        bankAccount: { select: { name: true, bankName: true } },
      },
      orderBy: { date: 'desc' },
      take: data.limit,
    })

    // Pra cada OFX, roda matcher. Limita processamento sequencial pra evitar
    // explosão de queries paralelas no Postgres.
    const pairs: Array<{
      ofx: {
        id: string
        description: string
        amount: number
        date: string
        type: string
        bankAccount: { name: string; bankName: string | null } | null
      }
      candidate: {
        id: string
        description: string
        amount: number
        dueDate: string
        lifecycle: string
      }
      score: number
      breakdown: { amount: number; date: number; supplier: number; description: number }
      reasoning: string[]
    }> = []

    let processed = 0
    let withMatch = 0

    for (const ofx of ofxTxs) {
      if (!ofx.bankAccountId) continue
      processed += 1
      const ofxInput = {
        id: ofx.id,
        description: ofx.description,
        amount: Math.abs(ofx.amount),
        type: ofx.type as 'CREDIT' | 'DEBIT',
        date: ofx.date,
        supplierId: ofx.supplierId,
        bankAccountId: ofx.bankAccountId,
      }

      const candidates = await findReconciliationCandidates(ofxInput, data.empresaId)
      if (candidates.length === 0) continue

      const ranked = rankCandidates(ofxInput, candidates)
      const top = ranked[0]
      if (!top || top.score < data.minScore) continue

      const candidateMeta = candidates.find((c) => c.id === top.candidateId)
      if (!candidateMeta) continue

      withMatch += 1
      pairs.push({
        ofx: {
          id: ofx.id,
          description: ofx.description,
          amount: ofx.amount,
          date: ofx.date.toISOString(),
          type: ofx.type,
          bankAccount: ofx.bankAccount,
        },
        candidate: {
          id: candidateMeta.id,
          description: candidateMeta.description,
          amount: candidateMeta.amount,
          dueDate: candidateMeta.dueDate.toISOString(),
          lifecycle: candidateMeta.lifecycle,
        },
        score: top.score,
        breakdown: top.breakdown,
        reasoning: top.reasoning,
      })
    }

    // Ordena por score desc + valor desc (UI vai mostrar mais "ganhos" primeiro)
    pairs.sort((a, b) => b.score - a.score || b.ofx.amount - a.ofx.amount)

    const totalValor = pairs.reduce((acc, p) => acc + Math.abs(p.ofx.amount), 0)

    return NextResponse.json({
      pairs,
      stats: {
        ofxScanned: processed,
        withMatch,
        skipped: processed - withMatch,
        totalValor,
        minScore: data.minScore,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
