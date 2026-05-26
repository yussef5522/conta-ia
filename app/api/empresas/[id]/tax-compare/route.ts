// Sprint 5.0.2 — POST compara Simples + Presumido + Real e recomenda melhor.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { taxCompareSchema } from '@/lib/validations/tax-compare'
import { compareRegimes } from '@/lib/tax/comparison-engine'
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
    const data = taxCompareSchema.parse(body)

    const profile = await prisma.companyTaxProfile.findUnique({
      where: { companyId },
    })

    const now = new Date()
    const rbaAcumulada = await calculateRBA12m(
      companyId,
      now.getUTCFullYear(),
      now.getUTCMonth() + 1,
    )

    const result = compareRegimes({
      receitaBrutaMes: data.receitaBrutaMes,
      rbaAcumulada,
      folha12m: profile?.folha12m ?? 0,
      anexoSimples: data.anexoSimples ?? (profile?.simplesAnexo as 'ANEXO_III' | null | undefined) ?? null,
      atividade: data.atividade,
      margemRealPercent: data.margemRealPercent,
      estado: data.estado ?? profile?.estado ?? null,
      hasICMS: data.hasICMS,
      hasISS: data.hasISS,
      creditosPIS: data.creditosPIS,
      creditosCOFINS: data.creditosCOFINS,
      // Sprint 5.0.2.f
      comprasMes: data.comprasMes,
      cnaeCode: data.cnaeCode ?? profile?.cnae ?? null,
      hasSocioPJ: data.hasSocioPJ,
      hasDebitos: data.hasDebitos,
    })

    return NextResponse.json({
      input: { ...data, rbaAcumulada, folha12m: profile?.folha12m ?? 0 },
      result,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
