// GET /api/empresas/[id]/imports/[importId] — detalhe de um import OFX.
// Sprint 2.3 Onda 2.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'

interface Params {
  params: Promise<{ id: string; importId: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId, importId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.view')

    const imp = await prisma.ofxImport.findFirst({
      where: { id: importId, bankAccount: { companyId: empresaId } },
      include: {
        bankAccount: {
          select: { id: true, name: true, bankName: true, bankCode: true },
        },
        user: { select: { id: true, name: true, email: true } },
        revertedBy: { select: { id: true, name: true } },
      },
    })
    if (!imp) {
      return NextResponse.json(
        { erro: 'Import não encontrado' },
        { status: 404 },
      )
    }

    // Conta transações que ainda referenciam esse import
    const txCount = await prisma.transaction.count({ where: { importId } })

    return NextResponse.json({ import: imp, transacoesVinculadas: txCount })
  } catch (err) {
    return handleApiError(err)
  }
}
