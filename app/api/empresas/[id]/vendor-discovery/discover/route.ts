// Sprint 5.0.2.n — POST /api/empresas/[id]/vendor-discovery/discover
// Roda o pipeline de discovery (cache → BrasilAPI → Claude) em UMA transação
// e salva log.
//
// Body: { transactionId: string }
// Response: VendorDiscoveryResult + logId

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { discoverVendor } from '@/lib/vendor-discovery/discover'

const schema = z.object({
  transactionId: z.string().cuid(),
})

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.update')

    const body = await request.json()
    const input = schema.parse(body)

    const tx = await prisma.transaction.findUnique({
      where: { id: input.transactionId },
      select: {
        id: true,
        description: true,
        type: true,
        bankAccount: { select: { companyId: true } },
      },
    })
    if (!tx || !tx.bankAccount) {
      return NextResponse.json({ erro: 'Transação não encontrada' }, { status: 404 })
    }
    if (tx.bankAccount.companyId !== companyId) {
      return NextResponse.json({ erro: 'Forbidden' }, { status: 403 })
    }

    const result = await discoverVendor({
      description: tx.description,
      type: tx.type,
    })

    const log = await prisma.vendorDiscoveryLog.create({
      data: {
        companyId,
        transactionId: tx.id,
        vendorNameQueried: tx.description?.slice(0, 200) ?? '',
        cnpjQueried: result.cnpj ?? null,
        origem: result.source,
        resultado: result.found
          ? 'FOUND'
          : result.confidence > 0
            ? 'LOW_CONFIDENCE'
            : 'NOT_FOUND',
        responseTime: result.responseTimeMs,
        custoApi: result.custoApi ?? null,
      },
    })

    return NextResponse.json({ ...result, logId: log.id })
  } catch (error) {
    return handleApiError(error)
  }
}
