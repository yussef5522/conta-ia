// Sprint Fluxo-Único-Retirada (08/06/2026) — Endpoint que retorna tx PJ
// EFFECTED categorizadas como retirada (DISTRIBUICAO_LUCROS / DESPESAS_PESSOAL)
// que AINDA NÃO têm ponte PJ→PF ativa.
//
// Usado em:
//   - Dashboard PJ: contador "X retiradas órfãs" (apenas count)
//   - (futuro) /transacoes filtro "Retiradas órfãs"
//
// Filtros SQL (Prisma) já fazem TODA a triagem — não precisa filtrar
// client-side via isOrphanWithdrawal. A função pura é usada nas listas
// que carregam tx pra outros fins (verifica se DEVE mostrar o card).

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { orphanWithdrawalWhere } from '@/lib/withdrawals/orphan-query'

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.view')

    const sp = new URL(request.url).searchParams
    const includeList = sp.get('includeList') === 'true'
    const limit = Math.max(1, Math.min(100, Number(sp.get('limit')) || 50))

    // FONTE ÚNICA (13/08): mesma consulta canônica que o sidebar e o empty state.
    const where = orphanWithdrawalWhere(empresaId)

    if (!includeList) {
      const [count, agg] = await Promise.all([
        prisma.transaction.count({ where }),
        prisma.transaction.aggregate({ where, _sum: { amount: true } }),
      ])
      return NextResponse.json({ count, totalAmount: agg._sum.amount ?? 0 })
    }

    const [count, orfas] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.findMany({
        where,
        select: {
          id: true,
          date: true,
          amount: true,
          description: true,
          bankAccount: { select: { id: true, name: true, accountType: true } },
          category: {
            select: { id: true, name: true, color: true, dreGroup: true },
          },
        },
        orderBy: { date: 'desc' },
        take: limit,
      }),
    ])

    return NextResponse.json({ count, orfas })
  } catch (err) {
    return handleApiError(err)
  }
}
