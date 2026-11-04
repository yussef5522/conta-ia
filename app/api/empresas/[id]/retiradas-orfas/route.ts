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
import { dinheirosDeRetiradaPendentes } from '@/lib/withdrawals/dinheiro-da-retirada'

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

    /**
     * ⛔⛔ FONTE ÚNICA, E AGORA POR DINHEIRO (05/11/2026).
     *
     * Este endpoint tinha `count` e `findMany` PRÓPRIOS sobre o where de linha — e era ele
     * que a tela "Resolver retiradas em lote" consome. Por isso o dono via **5 linhas pra 2
     * dinheiros**: os dois lados conciliados de formatura (190) e camiseta (59), lado a
     * lado, mais 3 fantasmas já resolvidos pelo lado OFX.
     *
     * ⚠️ `dinheirosDeRetiradaPendentes` é a MESMA derivação do banner e da sidebar. *Duas
     * telas decidindo o mesmo dinheiro é como a dobra entra.*
     */
    const dinheiros = await dinheirosDeRetiradaPendentes(prisma, empresaId)
    const count = dinheiros.length
    const totalAmount = Math.round(dinheiros.reduce((s, d) => s + d.amount, 0) * 100) / 100

    if (!includeList) {
      return NextResponse.json({ count, totalAmount })
    }

    // ⚠️ a forma do payload NÃO muda (a tela já consome `orfas[].bankAccount.name` etc.):
    // o que muda é que cada item agora é um DINHEIRO, não uma linha.
    const ids = dinheiros.slice(0, limit).map((d) => d.id)
    const detalhe = await prisma.transaction.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        date: true,
        amount: true,
        description: true,
        bankAccount: { select: { id: true, name: true, accountType: true } },
        category: { select: { id: true, name: true, color: true, dreGroup: true } },
      },
    })
    const porId = new Map(detalhe.map((d) => [d.id, d]))
    const orfas = dinheiros.slice(0, limit).map((d) => {
      const base = porId.get(d.id)!
      // ⭐ número do extrato, rótulo da mão — a régua de `montarDinheiro`, não uma 2ª cópia
      return { ...base, amount: d.amount, description: d.description }
    })

    return NextResponse.json({ count, totalAmount, orfas })
  } catch (err) {
    return handleApiError(err)
  }
}
