// Sprint 5.0.1 — calcula DAS Simples Nacional pra mês de competência.
//
// Fluxo:
//   1. Valida perfil existe + é SIMPLES_NACIONAL
//   2. Calcula RBA acumulada 12m via lib/tax/calculate-rba.ts
//   3. Chama engine puro calculateSimples
//   4. Persiste TaxCalculation (upsert por profile+ano+mes)
//   5. Retorna resultado
//
// ⚠️ DISCLAIMER: cálculo ESTIMADO. Verifique tabelas vigentes na RFB.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { taxCalculateSchema } from '@/lib/validations/tax'
import { calculateSimples } from '@/lib/tax/simples-engine'
import type { SimplesAnexo } from '@/lib/tax/simples-nacional-tables'
import { calculateRBA12m } from '@/lib/tax/calculate-rba'
import { logAudit } from '@/lib/audit'

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.update')

    const body = await request.json()
    const data = taxCalculateSchema.parse(body)

    const profile = await prisma.companyTaxProfile.findUnique({
      where: { companyId },
    })
    if (!profile) {
      return NextResponse.json(
        { erro: 'Perfil tributário não configurado. Acesse /tributario/perfil' },
        { status: 422 },
      )
    }
    if (profile.regime !== 'SIMPLES_NACIONAL') {
      return NextResponse.json(
        { erro: `Sprint 5.0.1 calcula apenas SIMPLES_NACIONAL. Regime atual: ${profile.regime}` },
        { status: 422 },
      )
    }
    if (!profile.simplesAnexo) {
      return NextResponse.json(
        { erro: 'Anexo do Simples não definido no perfil' },
        { status: 422 },
      )
    }

    // RBA acumulada (12m anteriores ao mês de competência)
    const rbaAcumulada = await calculateRBA12m(companyId, data.paYear, data.paMonth)

    // Engine puro
    const result = calculateSimples({
      anexo: profile.simplesAnexo as SimplesAnexo,
      receitaBrutaMes: data.receitaBrutaMes,
      rbaAcumulada,
      folha12m: profile.folha12m,
    })

    // Persiste snapshot (upsert por profile+ano+mes)
    const calculation = await prisma.taxCalculation.upsert({
      where: {
        profileId_paYear_paMonth: {
          profileId: profile.id,
          paYear: data.paYear,
          paMonth: data.paMonth,
        },
      },
      create: {
        profileId: profile.id,
        companyId,
        paYear: data.paYear,
        paMonth: data.paMonth,
        regime: profile.regime,
        simplesAnexo: profile.simplesAnexo,
        receitaBruta: data.receitaBrutaMes,
        rbaAcumulada,
        folha12m: profile.folha12m,
        fatorR: result.fatorR,
        aliquotaNominal: result.aliquotaNominal,
        parcelaDeduzir: result.parcelaDeduzir,
        aliquotaEfetiva: result.aliquotaEfetiva,
        dasValue: result.dasValue,
        breakdown: JSON.stringify({ ...result.breakdown, warnings: result.warnings }),
        versaoTabela: '2026',
      },
      update: {
        receitaBruta: data.receitaBrutaMes,
        rbaAcumulada,
        folha12m: profile.folha12m,
        fatorR: result.fatorR,
        aliquotaNominal: result.aliquotaNominal,
        parcelaDeduzir: result.parcelaDeduzir,
        aliquotaEfetiva: result.aliquotaEfetiva,
        dasValue: result.dasValue,
        breakdown: JSON.stringify({ ...result.breakdown, warnings: result.warnings }),
      },
    })

    await logAudit(ctx, {
      action: 'CREATE',
      entityType: 'TaxCalculation',
      entityId: calculation.id,
      metadata: {
        paYear: data.paYear,
        paMonth: data.paMonth,
        dasValue: result.dasValue,
        anexoUsado: result.anexoUsado,
        fatorRApplied: result.fatorRApplied,
      },
      request,
    })

    return NextResponse.json({
      calculation: {
        ...calculation,
        breakdownParsed: JSON.parse(calculation.breakdown),
      },
      result,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
