// Sprint 5.0.2.t — Corrige transações categorizadas com tipo INCOMPATÍVEL.
//
// Cenários alvo:
//   - tx.type = DEBIT (saída) categorizada com category.type = INCOME (receita) — ERRADO
//   - tx.type = CREDIT (entrada) categorizada com category.type = EXPENSE (despesa) — ERRADO
//
// Ação: volta categoryId = null + status = PENDING. NÃO mexe em
// AiLearningRules (caller pode rodar /pendentes pra refazer aprendizado).

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { isCategoryCompatibleWithTxType } from '@/lib/categorization/type-validation'

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.update')

    const t0 = Date.now()

    // Pega tx com categoria atribuída e join com categoria
    const txs = await prisma.transaction.findMany({
      where: {
        bankAccount: { companyId },
        categoryId: { not: null },
        type: { not: 'TRANSFER' },
      },
      select: {
        id: true,
        type: true,
        category: { select: { id: true, name: true, type: true } },
      },
      take: 5000,
    })

    const mismatches: Array<{
      id: string
      txType: string
      categoryName: string | null
      categoryType: string | null
    }> = []

    for (const tx of txs) {
      if (!tx.category) continue
      if (!isCategoryCompatibleWithTxType(tx.category.type, tx.type)) {
        mismatches.push({
          id: tx.id,
          txType: tx.type,
          categoryName: tx.category.name,
          categoryType: tx.category.type,
        })
      }
    }

    if (mismatches.length === 0) {
      return NextResponse.json({
        corrigidas: 0,
        mensagem: 'Nenhum mismatch de tipo encontrado',
        elapsedMs: Date.now() - t0,
      })
    }

    // Volta pra PENDING (sem categoria)
    const updated = await prisma.transaction.updateMany({
      where: {
        id: { in: mismatches.map((m) => m.id) },
        bankAccount: { companyId },
      },
      data: {
        categoryId: null,
        status: 'PENDING',
        classificationSource: null,
        classifiedByRuleId: null,
        aiConfidence: null,
      },
    })

    const elapsedMs = Date.now() - t0
    console.log(
      `[CLEANUP-TYPE-MISMATCHES] company=${companyId} corrigidas=${updated.count} ` +
        `elapsed=${elapsedMs}ms`,
    )

    return NextResponse.json({
      corrigidas: updated.count,
      analisadas: txs.length,
      sampleMismatches: mismatches.slice(0, 10),
      elapsedMs,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
