// Sprint CDB/Royalties (02/08/2026) — GET preview da reclassificação de CDB.
// READ-ONLY: não grava. Lista aplicação/resgate/IOF/REND detectados, mapeia pra
// categoria-alvo existente, e mostra movimentação (caixa) antes/depois.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { detectCdbNature, CDB_TARGET_CATEGORY, isCdbTransfer, type CdbNature } from '@/lib/cdb/detect'

export const runtime = 'nodejs'
interface Params { params: Promise<{ id: string }> }
const r2 = (n: number) => Math.round(n * 100) / 100

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.view')

    // Categorias-alvo por nome (o plano academia/restaurante já tem todas).
    const cats = await prisma.category.findMany({
      where: { companyId: empresaId, name: { in: Object.values(CDB_TARGET_CATEGORY) } },
      select: { id: true, name: true, isActive: true, dreGroup: true },
    })
    const catByName = new Map(cats.map((c) => [c.name, c]))

    // Todas as tx EFFECTED da empresa (a detecção é por memo).
    const txs = await prisma.transaction.findMany({
      where: { bankAccount: { companyId: empresaId }, lifecycle: 'EFFECTED' },
      select: { id: true, description: true, amount: true, type: true, date: true, categoryId: true, bankAccountId: true },
    })

    const items: Array<{ txId: string; nature: CdbNature; description: string; amount: number; type: string; date: string; targetCategory: string | null; targetCategoryId: string | null; targetActive: boolean; alreadyCategorized: boolean }> = []
    const counts: Record<string, number> = {}
    let despesaAntes = 0, receitaAntes = 0, aplicacaoSum = 0, resgateSum = 0
    for (const t of txs) {
      if (t.type === 'CREDIT') receitaAntes += t.amount
      else despesaAntes += t.amount
      const nature = detectCdbNature(t.description)
      if (!nature) continue
      counts[nature] = (counts[nature] ?? 0) + 1
      if (nature === 'APLICACAO') aplicacaoSum += t.amount
      if (nature === 'RESGATE') resgateSum += t.amount
      const target = catByName.get(CDB_TARGET_CATEGORY[nature])
      items.push({
        txId: t.id, nature, description: t.description, amount: t.amount, type: t.type, date: t.date.toISOString().slice(0, 10),
        targetCategory: target?.name ?? null, targetCategoryId: target?.id ?? null, targetActive: target?.isActive ?? false,
        alreadyCategorized: t.categoryId != null,
      })
    }

    // Movimentação (regime de caixa): remove aplicação da despesa e resgate da receita.
    const despesaDepois = r2(despesaAntes - aplicacaoSum)
    const receitaDepois = r2(receitaAntes - resgateSum)

    return NextResponse.json({
      counts,
      totals: {
        despesaAntes: r2(despesaAntes), despesaDepois,
        receitaAntes: r2(receitaAntes), receitaDepois,
        aplicacaoSum: r2(aplicacaoSum), resgateSum: r2(resgateSum),
      },
      // aplicação/resgate → transferência (fora do DRE); IOF/REND ficam no DRE.
      items: items.filter((i) => i.nature && (isCdbTransfer(i.nature) || i.nature === 'IOF' || i.nature === 'REND')),
      targetCategoriesMissing: Object.values(CDB_TARGET_CATEGORY).filter((n) => !catByName.has(n)),
    })
  } catch (error) {
    return handleApiError(error)
  }
}
