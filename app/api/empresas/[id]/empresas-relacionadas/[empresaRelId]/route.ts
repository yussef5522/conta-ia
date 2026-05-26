// Sprint 5.0.2.h — DELETE de EmpresaRelacionada.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'

interface Params {
  params: Promise<{ id: string; empresaRelId: string }>
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId, empresaRelId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.delete')

    await prisma.empresaRelacionada.delete({ where: { id: empresaRelId, companyId } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
