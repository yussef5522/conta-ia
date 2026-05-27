// Sprint 5.0.2.u — Reverte transferências que FALHAM nas regras estritas.
//
// Cenário: Sprint t marcou pares lenient. Sprint u introduziu validateTransferPair
// rigoroso. Esse endpoint passa o validate em TODOS pares já marcados e
// reverte os que falharem (volta tipo original DEBIT/CREDIT, status PENDING,
// limpa transferGroupId).
//
// Como inferir tipo original: o transferGroupId foi gerado pelo padrão
// `tx_${debit.id}_${credit.id}`. Extraímos os 2 IDs e sabemos qual era qual.
//
// Estratégia conservadora: se o transferGroupId NÃO segue esse padrão (ex:
// foi criado por Sprint 0.5 transferências manuais), pula esse par.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { validateTransferPair } from '@/lib/conciliation/active-transfer-detector'

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.update')

    const empresa = await prisma.company.findUnique({
      where: { id: companyId },
      select: { cnpj: true },
    })
    if (!empresa?.cnpj) {
      return NextResponse.json(
        { erro: 'Empresa sem CNPJ — não dá pra validar transferências' },
        { status: 422 },
      )
    }

    const t0 = Date.now()

    // Pega todas tx TRANSFER com transferGroupId do padrão Sprint t
    const transfers = await prisma.transaction.findMany({
      where: {
        bankAccount: { companyId },
        type: 'TRANSFER',
        transferGroupId: { not: null },
      },
      select: {
        id: true,
        description: true,
        date: true,
        paymentDate: true,
        amount: true,
        type: true,
        transferGroupId: true,
        bankAccountId: true,
        classificationSource: true,
      },
    })

    // Agrupa por transferGroupId, garante par debit+credit, valida.
    const grupos = new Map<string, typeof transfers>()
    for (const tx of transfers) {
      if (!tx.transferGroupId) continue
      const list = grupos.get(tx.transferGroupId) ?? []
      list.push(tx)
      grupos.set(tx.transferGroupId, list)
    }

    type Item = {
      id: string
      description: string | null
      reason: string
    }
    const reverted: Item[] = []

    for (const [transferGroupId, pares] of grupos) {
      if (pares.length !== 2) continue

      // Detecta padrão tx_<debitId>_<creditId> da Sprint t/u
      const match = transferGroupId.match(/^tx_([^_]+)_([^_]+)$/)
      if (!match) continue
      const [, debitId, creditId] = match

      const debit = pares.find((p) => p.id === debitId)
      const credit = pares.find((p) => p.id === creditId)
      if (!debit || !credit) continue

      const validation = validateTransferPair({
        debit: {
          description: debit.description,
          date: debit.date,
          paymentDate: debit.paymentDate,
        },
        credit: {
          description: credit.description,
          date: credit.date,
          paymentDate: credit.paymentDate,
        },
        companyCnpj: empresa.cnpj,
      })

      if (validation.valid && validation.confidence >= 0.85) continue // segue OK

      // REVERTER: volta type original (DEBIT/CREDIT extraído do ID) + PENDING
      await prisma.$transaction([
        prisma.transaction.update({
          where: { id: debit.id },
          data: {
            type: 'DEBIT',
            transferGroupId: null,
            status: 'PENDING',
            classificationSource: null,
            aiConfidence: null,
          },
        }),
        prisma.transaction.update({
          where: { id: credit.id },
          data: {
            type: 'CREDIT',
            transferGroupId: null,
            status: 'PENDING',
            classificationSource: null,
            aiConfidence: null,
          },
        }),
      ])

      reverted.push(
        {
          id: debit.id,
          description: debit.description,
          reason: validation.reason ?? 'confidence < 0.85',
        },
        {
          id: credit.id,
          description: credit.description,
          reason: validation.reason ?? 'confidence < 0.85',
        },
      )
    }

    const elapsedMs = Date.now() - t0
    console.log(
      `[UNMARK-BAD-TRANSFERS] company=${companyId} pares_revertidos=${reverted.length / 2} ` +
        `elapsed=${elapsedMs}ms`,
    )

    return NextResponse.json({
      paresRevertidos: reverted.length / 2,
      transacoesRevertidas: reverted.length,
      sample: reverted.slice(0, 10),
      elapsedMs,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
