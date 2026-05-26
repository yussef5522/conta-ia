// Sprint 5.0.2.p — Preview do "Auto-categorizar tudo" (sem aplicar).
//
// Roda o pipeline 5-fases (Sprint l/m/n) em todas pendentes e retorna o que
// SERIA aplicado, AGRUPADO POR CATEGORIA pro user revisar.
//
// Sequência UX:
//   1. POST /preview → modal abre com plano
//   2. User filtra/edita
//   3. POST /apply com seleção final

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { buildCategorizePlan } from '@/lib/categorization/build-categorize-plan'

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.view')

    const t0 = Date.now()
    const plan = await buildCategorizePlan(companyId)

    // Agrupa por categoria pra UI
    type Grupo = {
      categoryId: string
      categoryName: string
      count: number
      totalAmount: number
      transacoes: typeof plan.planEntries
    }
    const grupos = new Map<string, Grupo>()
    for (const entry of plan.planEntries) {
      const g = grupos.get(entry.categoryId)
      if (g) {
        g.count++
        g.totalAmount += entry.amount
        g.transacoes.push(entry)
      } else {
        grupos.set(entry.categoryId, {
          categoryId: entry.categoryId,
          categoryName: entry.categoryName,
          count: 1,
          totalAmount: entry.amount,
          transacoes: [entry],
        })
      }
    }

    const resumoPorCategoria = Array.from(grupos.values()).sort(
      (a, b) => b.count - a.count,
    )

    const elapsedMs = Date.now() - t0
    console.log(
      `[AUTO-CATEGORIZE-PREVIEW] company=${companyId} setor=${plan.setor ?? 'none'} ` +
        `analisadas=${plan.totalAnalisadas} sugestoes=${plan.planEntries.length} ` +
        `sem_sugestao=${plan.semSugestao} elapsed=${elapsedMs}ms`,
    )

    return NextResponse.json({
      setor: plan.setor,
      totalAnalisadas: plan.totalAnalisadas,
      totalSugeridas: plan.planEntries.length,
      semSugestao: plan.semSugestao,
      breakdown: plan.breakdown,
      resumoPorCategoria,
      elapsedMs,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
