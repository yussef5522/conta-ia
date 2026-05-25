// Sprint 5.0.2.b — POST análise expert por CNAE.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { taxExpertiseSchema } from '@/lib/validations/tax-expertise'
import { analyzeCNAEExpertise } from '@/lib/tax/cnae-expert-engine'
import { calculateRBA12m } from '@/lib/tax/calculate-rba'

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.view')

    const body = await request.json()
    const data = taxExpertiseSchema.parse(body)

    const profile = await prisma.companyTaxProfile.findUnique({
      where: { companyId },
    })

    const now = new Date()
    const rba12m = await calculateRBA12m(
      companyId,
      now.getUTCFullYear(),
      now.getUTCMonth() + 1,
    )

    const analysis = analyzeCNAEExpertise({
      cnae: data.cnae,
      regime: profile?.regime ?? 'SIMPLES_NACIONAL',
      anexoSimples: profile?.simplesAnexo ?? null,
      receitaMensal: data.receitaMensal,
      rba12m,
      folha12m: profile?.folha12m ?? 0,
      estado: profile?.estado ?? null,
      hasDelivery: data.hasDelivery,
      vendeBebidas: data.vendeBebidas,
    })

    if (!analysis) {
      return NextResponse.json(
        { erro: `CNAE ${data.cnae} ainda não tem expertise cadastrada.` },
        { status: 404 },
      )
    }

    return NextResponse.json({
      input: { ...data, rba12m, folha12m: profile?.folha12m ?? 0 },
      analysis,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
