// Sprint Fluxo-Unificado-Retirada (30/06/2026) — fila de retiradas
// categorizadas como distribuição que ainda NÃO viraram ponte PJ→PF.
//
// Query (validada READ-ONLY 30/06 na Cacula = 13 tx):
//   type=DEBIT + status=RECONCILED
//   + (category.dreGroup='DISTRIBUICAO_LUCROS'
//      OR (category.dreGroup='DESPESAS_PESSOAL' AND normalize(name) LIKE '%pro-labore%'))
//   + NOT EXISTS pj_to_pf_bridges.pjTransactionId = t.id
//
// Cache 60s, tag `retiradas-pendentes:${empresaId}`.
// Invalidação: reuso de tag padrão via revalidateTag ao criar/deletar ponte.

import { NextRequest, NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/db'
import { getAuthContext, AuthenticationError, ForbiddenError } from '@/lib/auth/rbac'
import { listOrphanWithdrawals } from '@/lib/withdrawals/orphan-query'

export interface RetiradaPendente {
  id: string
  date: string
  amount: number
  description: string
  bankAccountId: string
  bankAccountName: string
  categoryId: string
  categoryName: string
  dreGroup: string | null
}

export interface RetiradasPendentesResponse {
  tx: RetiradaPendente[]
  total: number
  totalAmount: number
}

function errorResponse(err: unknown) {
  if (err instanceof AuthenticationError) {
    return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  }
  if (err instanceof ForbiddenError) {
    return NextResponse.json({ erro: err.message }, { status: 403 })
  }
  throw err
}

// FONTE ÚNICA (13/08): usa a MESMA consulta canônica do banner (retiradas-orfas)
// — `listOrphanWithdrawals`. Antes tinha lógica própria (status=RECONCILED +
// pró-labore por nome, sem excluir interna/agrupada) que DISCORDAVA do banner.
// Agora banner e sidebar leem a mesma fonte → impossível divergir.
async function loadRetiradas(companyId: string): Promise<RetiradasPendentesResponse> {
  const rows = await listOrphanWithdrawals(prisma, companyId)
  const tx: RetiradaPendente[] = rows.map((r) => ({
    id: r.id,
    date: r.date,
    amount: r.amount,
    description: r.description,
    bankAccountId: r.bankAccountId,
    bankAccountName: r.bankAccountName,
    categoryId: r.categoryId ?? '',
    categoryName: r.categoryName ?? '',
    dreGroup: 'DISTRIBUICAO_LUCROS',
  }))
  const totalAmount = tx.reduce((s, t) => s + t.amount, 0)
  return { tx, total: tx.length, totalAmount }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: companyId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.view')

    const cached = unstable_cache(
      () => loadRetiradas(companyId),
      [`retiradas-pendentes:${companyId}`],
      { revalidate: 60, tags: [`retiradas-pendentes:${companyId}`] },
    )
    const data = await cached()
    return NextResponse.json(data)
  } catch (err) {
    return errorResponse(err)
  }
}
