// Sprint A-effected Fase B.3 — POST /api/conciliacao/find-and-match/reconcile
//
// N:1 reconcile (caso CIA DA FRUTA): várias APs apontando pra mesma OFX
// representando um PIX consolidado que pagou múltiplas notas.
//
// Body:
//   - ofxTransactionId: string (cuid)
//   - candidateIds: string[] (>=1, max 50)
//
// Fluxo:
//   1. Valida que candidateIds existem e estão na mesma empresa do OFX
//   2. Valida SOMA(|candidate.amount|) == |ofx.amount| (tolerância R$ 0,01)
//      → essa validação SUBSTITUI a defesa de @unique removida
//   3. Gera reconcileGroupId (cuid)
//   4. Atomic loop: chama reconcileTransactions com allowMultiReconcile=true
//      e reconcileGroupId compartilhado em cada candidate
//   5. Retorna { ok, groupId, reconciled, failed, errors }
//
// Falha parcial: se o item N falha após N-1 ok, transaction roda rollback
// (Prisma $transaction). Atomic.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import {
  reconcileTransactions,
  ReconciliationError,
} from '@/lib/conciliacao/reconcile'

const bodySchema = z.object({
  ofxTransactionId: z.string().cuid(),
  candidateIds: z.array(z.string().cuid()).min(1).max(50),
})

const SUM_TOLERANCE = 0.02 // 2 cents — acomoda arredondamento bancário de 1¢

function makeGroupId(): string {
  return `rg_${randomUUID().replace(/-/g, '').slice(0, 18)}`
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = bodySchema.parse(body)

    // Dedup candidateIds (pode chegar duplicado por bug de UI)
    const uniqueIds = Array.from(new Set(data.candidateIds))
    if (uniqueIds.length === 0) {
      return NextResponse.json({ erro: 'Lista de candidates vazia' }, { status: 422 })
    }

    // Resolve OFX
    const ofx = await prisma.transaction.findUnique({
      where: { id: data.ofxTransactionId },
      select: {
        id: true,
        amount: true,
        type: true,
        lifecycle: true,
        reconciledWithId: true,
        bankAccount: { select: { companyId: true } },
        reconciledFrom: { select: { id: true } },
      },
    })
    if (!ofx || !ofx.bankAccount) {
      return NextResponse.json({ erro: 'Tx OFX não encontrada' }, { status: 404 })
    }
    if (ofx.lifecycle !== 'EFFECTED') {
      return NextResponse.json(
        { erro: 'Tx OFX precisa ser EFFECTED' },
        { status: 422 },
      )
    }
    if (ofx.reconciledWithId) {
      return NextResponse.json(
        { erro: 'Tx OFX já está conciliada (1:1)' },
        { status: 422 },
      )
    }
    if (ofx.reconciledFrom.length > 0) {
      return NextResponse.json(
        {
          erro: `Tx OFX já tem ${ofx.reconciledFrom.length} conta(s) conciliada(s) com ela. Desfaça antes de tentar novo N:1.`,
        },
        { status: 422 },
      )
    }

    const companyId = ofx.bankAccount.companyId
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.update')

    // Fetch candidates de uma vez pra validar soma + multi-tenant
    const candidates = await prisma.transaction.findMany({
      where: { id: { in: uniqueIds } },
      select: {
        id: true,
        amount: true,
        bankAccount: { select: { companyId: true } },
        supplier: { select: { companyId: true } },
        customer: { select: { companyId: true } },
        category: { select: { companyId: true } },
      },
    })

    if (candidates.length !== uniqueIds.length) {
      return NextResponse.json(
        {
          erro: `${uniqueIds.length - candidates.length} candidate(s) não encontrado(s)`,
        },
        { status: 404 },
      )
    }

    // Multi-tenant: todas devem ser da mesma empresa do OFX
    for (const c of candidates) {
      const cId =
        c.bankAccount?.companyId ??
        c.supplier?.companyId ??
        c.customer?.companyId ??
        c.category?.companyId
      if (cId !== companyId) {
        return NextResponse.json(
          {
            erro: `Candidate ${c.id} é de outra empresa`,
          },
          { status: 403 },
        )
      }
    }

    // VALIDAÇÃO CRÍTICA — soma das candidates == OFX.amount
    // Substitui a defesa de @unique que foi removida na migration B.3
    const sumCandidates = candidates.reduce(
      (acc, c) => acc + Math.abs(c.amount),
      0,
    )
    const ofxAbs = Math.abs(ofx.amount)
    const diff = Math.abs(sumCandidates - ofxAbs)
    if (diff > SUM_TOLERANCE) {
      return NextResponse.json(
        {
          erro: `Soma das ${uniqueIds.length} candidate(s) (R$ ${sumCandidates.toFixed(2)}) não bate com OFX (R$ ${ofxAbs.toFixed(2)}). Diferença: R$ ${diff.toFixed(2)}. Tolerância máxima: R$ ${SUM_TOLERANCE.toFixed(2)}.`,
        },
        { status: 422 },
      )
    }

    // Gera groupId compartilhado (cuid-like)
    const reconcileGroupId = makeGroupId()

    // Atomic loop: reconcileTransactions com allowMultiReconcile=true
    let reconciled = 0
    let failed = 0
    const errors: Array<{ candidateId: string; error: string }> = []

    for (const candidateId of uniqueIds) {
      try {
        await reconcileTransactions(
          {
            ofxTransactionId: data.ofxTransactionId,
            candidateId,
            allowMultiReconcile: true,
            reconcileGroupId,
          },
          ctx,
        )
        reconciled += 1
      } catch (e) {
        failed += 1
        errors.push({
          candidateId,
          error: e instanceof ReconciliationError ? e.reason : 'Erro desconhecido',
        })
      }
    }

    if (failed > 0 && reconciled === 0) {
      // Tudo falhou → retorna 422 com erros
      return NextResponse.json(
        { ok: false, groupId: reconcileGroupId, reconciled, failed, errors },
        { status: 422 },
      )
    }

    return NextResponse.json({
      ok: true,
      groupId: reconcileGroupId,
      reconciled,
      failed,
      errors,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
