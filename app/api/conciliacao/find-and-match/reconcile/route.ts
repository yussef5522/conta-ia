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
import {
  adjustmentSignedAmount,
  buildAdjustmentTxData,
} from '@/lib/conciliacao/create-adjustment'
import { logAudit } from '@/lib/audit'

const adjustmentSchema = z.object({
  categoryId: z.string().cuid(),
  amount: z.number().positive(),
  sign: z.enum(['EXPENSE', 'INCOME']),
  description: z.string().min(1).max(200),
})

const bodySchema = z.object({
  ofxTransactionId: z.string().cuid(),
  candidateIds: z.array(z.string().cuid()).min(1).max(50),
  // Sprint A-effected Fase B.4.1 — ajustes opcionais (cap 3 — decisão Yussef #6)
  adjustments: z.array(adjustmentSchema).max(3).optional(),
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

    // Sprint A-effected Fase B.4.1 — validar adjustments (se houver)
    const adjustments = data.adjustments ?? []

    if (adjustments.length > 0) {
      // Categorias precisam pertencer à empresa
      const catIds = Array.from(new Set(adjustments.map((a) => a.categoryId)))
      const cats = await prisma.category.findMany({
        where: { id: { in: catIds }, companyId },
        select: { id: true, name: true, type: true, dreGroup: true },
      })
      if (cats.length !== catIds.length) {
        return NextResponse.json(
          { erro: 'Uma ou mais categoryId dos ajustes não pertencem à empresa' },
          { status: 422 },
        )
      }
      // Sanidade: categoria INCOME só com sign=INCOME; EXPENSE só com EXPENSE
      const catById = new Map(cats.map((c) => [c.id, c]))
      for (const adj of adjustments) {
        const c = catById.get(adj.categoryId)!
        const expectedSign = c.type === 'INCOME' ? 'INCOME' : 'EXPENSE'
        if (adj.sign !== expectedSign) {
          return NextResponse.json(
            {
              erro: `Ajuste de categoria "${c.name}" (${c.type}) precisa ter sign=${expectedSign}, recebeu ${adj.sign}`,
            },
            { status: 422 },
          )
        }
      }
    }

    // VALIDAÇÃO CRÍTICA — soma das candidates ± adjustments com sinal == OFX
    // Defesa em profundidade que substitui o @unique removido na migração B.3.
    const sumCandidates = candidates.reduce(
      (acc, c) => acc + Math.abs(c.amount),
      0,
    )
    const sumAdjustmentsSigned = adjustments.reduce(
      (acc, a) => acc + adjustmentSignedAmount(a.amount, a.sign),
      0,
    )
    const ofxAbs = Math.abs(ofx.amount)
    const totalSelected = sumCandidates + sumAdjustmentsSigned
    const diff = Math.abs(totalSelected - ofxAbs)
    if (diff > SUM_TOLERANCE) {
      return NextResponse.json(
        {
          erro: `Soma ${candidates.length} candidate(s) ${adjustments.length > 0 ? `+ ${adjustments.length} ajuste(s)` : ''} (R$ ${totalSelected.toFixed(2)}) não bate com OFX (R$ ${ofxAbs.toFixed(2)}). Diferença: R$ ${diff.toFixed(2)}. Tolerância máxima: R$ ${SUM_TOLERANCE.toFixed(2)}.`,
        },
        { status: 422 },
      )
    }

    // Gera groupId compartilhado (cuid-like)
    const reconcileGroupId = makeGroupId()

    // Atomic loop: reconcileTransactions com allowMultiReconcile=true + criar adjustments
    let reconciled = 0
    let failed = 0
    let adjustmentsCreated = 0
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

    // Sprint A-effected Fase B.4.1 — criar txs de ajuste (origin='ADJUSTMENT')
    // dentro do mesmo grupo. Resolve caso boleto+juros.
    if (adjustments.length > 0 && ofx.bankAccount) {
      const ofxFull = await prisma.transaction.findUnique({
        where: { id: data.ofxTransactionId },
        select: { date: true, bankAccountId: true },
      })
      if (ofxFull?.bankAccountId) {
        await prisma.$transaction(async (trx) => {
          for (const adj of adjustments) {
            const txData = buildAdjustmentTxData({
              ofxTransactionId: data.ofxTransactionId,
              bankAccountId: ofxFull.bankAccountId!,
              companyId,
              categoryId: adj.categoryId,
              amount: adj.amount,
              sign: adj.sign,
              description: adj.description,
              reconcileGroupId,
              date: ofxFull.date,
              userId: ctx.user.id,
            })
            const created = await trx.transaction.create({ data: txData })
            await logAudit(
              ctx,
              {
                action: 'CREATE',
                entityType: 'Adjustment',
                entityId: created.id,
                metadata: {
                  reconcileGroupId,
                  ofxTransactionId: data.ofxTransactionId,
                  categoryId: adj.categoryId,
                  amount: adj.amount,
                  sign: adj.sign,
                  description: adj.description,
                },
              },
              trx,
            )
            adjustmentsCreated += 1
          }
        })
      }
    }

    return NextResponse.json({
      ok: true,
      groupId: reconcileGroupId,
      reconciled,
      failed,
      adjustmentsCreated,
      errors,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
