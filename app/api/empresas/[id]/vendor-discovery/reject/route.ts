// Sprint 5.0.2.n — POST /api/empresas/[id]/vendor-discovery/reject
// Rejeita uma sugestão de Vendor Discovery:
//   1. Incrementa vezesRejeitado no cache global
//   2. Marca log como REJECTED
//   3. NÃO mexe na transação (continua PENDING)
//
// Body: { transactionId, cacheId, motivo? }

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { recordRejection } from '@/lib/vendor-discovery/cache-global'

const schema = z.object({
  transactionId: z.string().cuid(),
  cacheId: z.string().cuid(),
  logId: z.string().cuid().optional(),
  motivo: z.string().max(200).optional(),
})

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.update')

    const input = schema.parse(await request.json())

    // Confere multi-tenant (tx pertence à empresa)
    const tx = await prisma.transaction.findUnique({
      where: { id: input.transactionId },
      select: { bankAccount: { select: { companyId: true } } },
    })
    if (!tx || tx.bankAccount?.companyId !== companyId) {
      return NextResponse.json({ erro: 'Transação não encontrada' }, { status: 404 })
    }

    await recordRejection(input.cacheId)

    if (input.logId) {
      await prisma.vendorDiscoveryLog.update({
        where: { id: input.logId },
        data: { userAction: 'REJECTED' },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
