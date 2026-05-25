// Sprint 5.0.1 — GET/POST perfil tributário da empresa.
//
// ⚠️ DISCLAIMER: este endpoint armazena perfil pra cálculo ESTIMADO.
// NÃO substitui orientação contábil profissional.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { taxProfileUpsertSchema } from '@/lib/validations/tax'
import { logAudit } from '@/lib/audit'

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.view')

    const profile = await prisma.companyTaxProfile.findUnique({
      where: { companyId },
    })

    return NextResponse.json({ profile })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.update')

    const body = await request.json()
    const data = taxProfileUpsertSchema.parse(body)

    const existing = await prisma.companyTaxProfile.findUnique({
      where: { companyId },
    })

    const profile = await prisma.companyTaxProfile.upsert({
      where: { companyId },
      create: {
        companyId,
        regime: data.regime,
        simplesAnexo: data.simplesAnexo ?? null,
        folha12m: data.folha12m,
        proLabore: data.proLabore,
        cnae: data.cnae ?? null,
        enabled: data.enabled ?? true,
        createdById: ctx.user.id,
      },
      update: {
        regime: data.regime,
        simplesAnexo: data.simplesAnexo ?? null,
        folha12m: data.folha12m,
        proLabore: data.proLabore,
        cnae: data.cnae ?? null,
        enabled: data.enabled ?? true,
      },
    })

    await logAudit(ctx, {
      action: existing ? 'UPDATE' : 'CREATE',
      entityType: 'CompanyTaxProfile',
      entityId: profile.id,
      metadata: {
        regime: profile.regime,
        simplesAnexo: profile.simplesAnexo,
        folha12m: profile.folha12m,
      },
      request,
    })

    return NextResponse.json({ profile })
  } catch (error) {
    return handleApiError(error)
  }
}
