// Sprint 5.0.2.k — GET sugere padrão + similares pendentes após categorização manual.
//
// Body: { transactionId } da tx que o user acabou de categorizar.
// Retorna stem + count + total + sampleDescriptions pra modal "Criar regra?".

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { findSimilarPendingTransactions } from '@/lib/rules/find-similar-pending'

interface Params {
  params: Promise<{ id: string }>
}

const schema = z.object({
  transactionId: z.string().min(1),
})

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.view')

    const body = await request.json()
    const data = schema.parse(body)

    const tx = await prisma.transaction.findFirst({
      where: { id: data.transactionId, bankAccount: { companyId } },
      select: { description: true, type: true, categoryId: true },
    })
    if (!tx) {
      return NextResponse.json({ erro: 'Transação não encontrada' }, { status: 404 })
    }

    const result = await findSimilarPendingTransactions({
      companyId,
      baseTransactionId: data.transactionId,
      baseDescription: tx.description,
      baseType: tx.type,
      onlyPending: true,
    })

    return NextResponse.json({
      ...result,
      baseCategoryId: tx.categoryId,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
