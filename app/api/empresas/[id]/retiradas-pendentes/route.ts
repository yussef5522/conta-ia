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

function normalizeForProLabore(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

async function loadRetiradas(companyId: string): Promise<RetiradasPendentesResponse> {
  // Universo: DEBIT + RECONCILED + categoria carregada + sem bridge.
  // Filtro de dreGroup + nome pro-labore feito em JS (evita SQL complexo).
  const raw = await prisma.transaction.findMany({
    where: {
      bankAccount: { companyId },
      type: 'DEBIT',
      status: 'RECONCILED',
      categoryId: { not: null },
      // Sem bridge (LEFT JOIN + IS NULL via `none`).
      bridge: null,
    },
    select: {
      id: true,
      date: true,
      amount: true,
      description: true,
      bankAccountId: true,
      bankAccount: { select: { name: true } },
      categoryId: true,
      category: { select: { name: true, dreGroup: true } },
    },
    orderBy: { date: 'desc' },
  })

  const tx: RetiradaPendente[] = []
  let totalAmount = 0
  for (const r of raw) {
    const dre = r.category?.dreGroup ?? null
    const name = r.category?.name ?? ''
    const isDistribuicao = dre === 'DISTRIBUICAO_LUCROS'
    const isProLabore =
      dre === 'DESPESAS_PESSOAL' &&
      /pro-labore|pro labore|prolabore/.test(normalizeForProLabore(name))
    if (!isDistribuicao && !isProLabore) continue
    tx.push({
      id: r.id,
      date: r.date.toISOString(),
      amount: r.amount,
      description: r.description,
      bankAccountId: r.bankAccountId!,
      bankAccountName: r.bankAccount?.name ?? '—',
      categoryId: r.categoryId!,
      categoryName: name,
      dreGroup: dre,
    })
    totalAmount += r.amount
  }

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
