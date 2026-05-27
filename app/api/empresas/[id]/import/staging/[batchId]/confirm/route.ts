// Sprint 5.0.2.u — Confirma batch staging → move pra Transaction.
//
// Body: {
//   transfersToKeep: string[]    // IDs de StagedTransaction (1 lado basta — par é resolvido)
//   transfersToReject: string[]  // IDs de StagedTransaction que NÃO devem ser transferência
// }
//
// Comportamento:
//   1. Cria Transactions a partir dos StagedTransactions
//   2. Pares aceitos como transferência: type=TRANSFER, transferGroupId compartilhado, status=RECONCILED
//   3. Pares rejeitados: type original DEBIT/CREDIT, status=PENDING (categoriza depois)
//   4. Marca ImportStagings como CONFIRMED + importedAt

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'

const schema = z.object({
  transfersToKeep: z.array(z.string().cuid()).default([]),
  transfersToReject: z.array(z.string().cuid()).default([]),
})

interface Params {
  params: Promise<{ id: string; batchId: string }>
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId, batchId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.create')

    const body = await request.json().catch(() => ({}))
    const { transfersToKeep, transfersToReject } = schema.parse(body)
    const keepSet = new Set(transfersToKeep)
    const rejectSet = new Set(transfersToReject)

    const stagings = await prisma.importStaging.findMany({
      where: { companyId, batchId },
      include: { stagedTransactions: true },
    })
    if (stagings.length === 0) {
      return NextResponse.json({ erro: 'Batch não encontrado' }, { status: 404 })
    }

    // Map fitId → tx criada (pra resolver linkedTransactionId no 2º passe)
    const byStagedId = new Map<string, string>() // stagedId → transactionId
    let imported = 0
    let transfersMarked = 0

    // Passe 1: cria Transactions sem transferGroupId
    for (const staging of stagings) {
      for (const st of staging.stagedTransactions) {
        const keepAsTransfer =
          st.isInternalTransfer &&
          (keepSet.has(st.id) || keepSet.has(st.matchedStagedId ?? '')) &&
          !rejectSet.has(st.id)

        const created = await prisma.transaction.create({
          data: {
            bankAccountId: staging.bankAccountId,
            externalId: st.fitId,
            date: st.effectedDate,
            paymentDate: st.effectedDate,
            amount: st.amount,
            type: keepAsTransfer ? 'TRANSFER' : st.type,
            description: st.description,
            origin: 'OFX',
            status: keepAsTransfer ? 'RECONCILED' : 'PENDING',
            ...(keepAsTransfer
              ? {
                  classificationSource: 'AI',
                  aiConfidence: st.transferConfidence ?? 0.85,
                }
              : {}),
          },
        })
        byStagedId.set(st.id, created.id)
        imported++
      }
    }

    // Passe 2: linka transferGroupId pros pares aceitos
    for (const staging of stagings) {
      for (const st of staging.stagedTransactions) {
        if (!st.isInternalTransfer || !st.matchedStagedId) continue
        if (rejectSet.has(st.id) || rejectSet.has(st.matchedStagedId)) continue
        if (!keepSet.has(st.id) && !keepSet.has(st.matchedStagedId)) continue

        const myTxId = byStagedId.get(st.id)
        const pairTxId = byStagedId.get(st.matchedStagedId)
        if (!myTxId || !pairTxId) continue

        // Pra evitar duplicação de update, só processa quando id < matchedId
        if (st.id > st.matchedStagedId) continue

        const transferGroupId = `tx_${myTxId}_${pairTxId}`
        await prisma.$transaction([
          prisma.transaction.update({
            where: { id: myTxId },
            data: { transferGroupId },
          }),
          prisma.transaction.update({
            where: { id: pairTxId },
            data: { transferGroupId },
          }),
        ])
        transfersMarked++
      }
    }

    // Atualiza ImportStagings → CONFIRMED
    const importedAt = new Date()
    await prisma.importStaging.updateMany({
      where: { companyId, batchId },
      data: { status: 'CONFIRMED', importedAt },
    })

    // Limpa StagedTransactions (cascade não acontece pq são child rows)
    await prisma.stagedTransaction.deleteMany({
      where: { staging: { companyId, batchId } },
    })

    console.log(
      `[STAGING-CONFIRM] company=${companyId} batchId=${batchId} ` +
        `imported=${imported} transfersMarked=${transfersMarked}`,
    )

    return NextResponse.json({
      batchId,
      imported,
      transfersMarked,
      transfersRejected: rejectSet.size,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
