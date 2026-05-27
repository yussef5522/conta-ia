// Sprint 5.0.2.u — Detectar transferências cross-account num batch staging.
//
// Reusa validateTransferPair (active-transfer-detector estrito).
// Marca pares no staging (não cria Transactions ainda).

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import {
  validateTransferPair,
  isPixDebitDesc,
  isPixCreditDesc,
  isBlacklistedDesc,
  hasPersonName,
  descContainsCnpj,
} from '@/lib/conciliation/active-transfer-detector'

interface Params {
  params: Promise<{ id: string; batchId: string }>
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId, batchId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.create')

    const empresa = await prisma.company.findUnique({
      where: { id: companyId },
      select: { cnpj: true },
    })
    if (!empresa?.cnpj) {
      return NextResponse.json(
        { erro: 'Empresa sem CNPJ — não dá pra detectar transferências' },
        { status: 422 },
      )
    }

    const stagings = await prisma.importStaging.findMany({
      where: { companyId, batchId },
      include: { stagedTransactions: true },
    })
    if (stagings.length === 0) {
      return NextResponse.json({ erro: 'Batch não encontrado' }, { status: 404 })
    }

    // Achata tudo + carrega bankAccountId pra cada staged
    const allStaged = stagings.flatMap((s) =>
      s.stagedTransactions.map((tx) => ({
        ...tx,
        bankAccountId: s.bankAccountId,
      })),
    )

    let detections = 0
    type Sample = {
      debit: { id: string; description: string; amount: number }
      credit: { id: string; description: string; amount: number }
      confidence: number
      reason: string | null
    }
    const samples: Sample[] = []

    // Pra cada DEBIT, busca CREDIT match em outra bankAccount
    for (const debit of allStaged.filter((t) => t.type === 'DEBIT')) {
      // Pre-filtros rápidos
      if (!isPixDebitDesc(debit.description)) continue
      if (isBlacklistedDesc(debit.description)) continue
      if (hasPersonName(debit.description)) continue

      const debitDigits = debit.description.replace(/\D/g, '')
      const debitHasCnpj14 = /\d{14}/.test(debitDigits)
      if (debitHasCnpj14 && !descContainsCnpj(debit.description, empresa.cnpj)) continue

      // CREDIT candidatos: outra conta, valor exato, mesma data
      const candidatos = allStaged.filter(
        (t) =>
          t.type === 'CREDIT' &&
          t.bankAccountId !== debit.bankAccountId &&
          t.amount === debit.amount &&
          t.effectedDate.getUTCFullYear() === debit.effectedDate.getUTCFullYear() &&
          t.effectedDate.getUTCMonth() === debit.effectedDate.getUTCMonth() &&
          t.effectedDate.getUTCDate() === debit.effectedDate.getUTCDate() &&
          !t.isInternalTransfer,
      )

      const validated = candidatos
        .map((c) => ({
          c,
          v: validateTransferPair({
            debit: {
              description: debit.description,
              date: debit.effectedDate,
              paymentDate: null,
            },
            credit: {
              description: c.description,
              date: c.effectedDate,
              paymentDate: null,
            },
            companyCnpj: empresa.cnpj,
          }),
        }))
        .filter((x) => x.v.valid && x.v.confidence >= 0.85)

      if (validated.length === 0) continue
      if (validated.length > 1) continue // ambíguo

      const { c, v } = validated[0]
      const reason = 'PIX same-day + CNPJ próprio'
      await prisma.$transaction([
        prisma.stagedTransaction.update({
          where: { id: debit.id },
          data: {
            isInternalTransfer: true,
            matchedStagedId: c.id,
            transferConfidence: v.confidence,
            transferReason: reason,
          },
        }),
        prisma.stagedTransaction.update({
          where: { id: c.id },
          data: {
            isInternalTransfer: true,
            matchedStagedId: debit.id,
            transferConfidence: v.confidence,
            transferReason: reason,
          },
        }),
      ])

      detections++
      if (samples.length < 50) {
        samples.push({
          debit: {
            id: debit.id,
            description: debit.description,
            amount: debit.amount,
          },
          credit: {
            id: c.id,
            description: c.description,
            amount: c.amount,
          },
          confidence: v.confidence,
          reason,
        })
      }
    }

    // Atualiza status do batch
    await prisma.importStaging.updateMany({
      where: { companyId, batchId },
      data: { status: 'TRANSFER_DETECTED' },
    })

    console.log(
      `[STAGING-DETECT] company=${companyId} batchId=${batchId} ` +
        `detections=${detections} totalStaged=${allStaged.length}`,
    )

    return NextResponse.json({
      batchId,
      detections,
      totalStaged: allStaged.length,
      samples,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
