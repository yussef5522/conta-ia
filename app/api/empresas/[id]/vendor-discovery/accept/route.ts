// Sprint 5.0.2.n — POST /api/empresas/[id]/vendor-discovery/accept
// Aceita uma sugestão de Vendor Discovery:
//   1. Resolve categoryName → categoryId no plano de contas (cria via
//      ensureAllSystemCategories se não existir)
//   2. Aplica categoryId na transação (status=RECONCILED)
//   3. Marca log como ACCEPTED + incrementa vezesConfirmado no cache
//   4. Dispara autoMemorizeVendor (Sprint m) pra aprender anchor word
//
// Body: { transactionId, cacheId, categoryName }

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { recordAcceptance } from '@/lib/vendor-discovery/cache-global'
import { ensureAllSystemCategories } from '@/lib/categorias/ensure-system-categories'
import { resolveSetorCategoryId } from '@/lib/categorization/match-setor-pattern'
import { autoMemorizeVendor } from '@/lib/categorization/auto-memorize-vendor'

const schema = z.object({
  transactionId: z.string().cuid(),
  cacheId: z.string().cuid(),
  categoryName: z.string().min(2),
  /** Opcional: logId pra atualizar com userAction=ACCEPTED */
  logId: z.string().cuid().optional(),
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

    // Resolve categoryId pelo nome (criando categoria do sistema se preciso)
    const empresa = await prisma.company.findUnique({
      where: { id: companyId },
      select: { setor: true },
    })
    const systemCats = await ensureAllSystemCategories(companyId, empresa?.setor ?? null)
    const categoryId = resolveSetorCategoryId(systemCats.list, input.categoryName)

    if (!categoryId) {
      return NextResponse.json(
        { erro: `Categoria "${input.categoryName}" não encontrada no plano de contas` },
        { status: 422 },
      )
    }

    await prisma.transaction.update({
      where: { id: input.transactionId },
      data: {
        categoryId,
        status: 'RECONCILED',
        classificationSource: 'VENDOR_DISCOVERY',
        aiConfidence: 1.0,
      },
    })

    await recordAcceptance(input.cacheId)

    if (input.logId) {
      await prisma.vendorDiscoveryLog.update({
        where: { id: input.logId },
        data: { userAction: 'ACCEPTED', finalCategoryId: categoryId },
      })
    }

    // Sprint m vendor memory: cria regra CONTAINS no anchor word
    let vendorMemory: { anchor: string | null; retroactiveCount: number } = {
      anchor: null,
      retroactiveCount: 0,
    }
    try {
      const mem = await autoMemorizeVendor({
        companyId,
        baseTransactionId: tx.id,
        baseDescription: tx.description,
        categoryId,
        baseType: tx.type,
      })
      vendorMemory = {
        anchor: mem.anchor,
        retroactiveCount: mem.retroactiveCount,
      }
    } catch (e) {
      console.error('[VENDOR_DISCOVERY accept] memorize erro:', e)
    }

    return NextResponse.json({
      ok: true,
      categoryId,
      categoryName: input.categoryName,
      vendorMemory,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
