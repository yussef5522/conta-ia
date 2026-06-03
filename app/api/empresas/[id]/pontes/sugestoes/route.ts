// Sprint PF Fatia 4 — GET /api/empresas/[id]/pontes/sugestoes
// Lista sugestões de ponte pra empresa — filtrada por userId (privacidade).

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, AuthenticationError, ForbiddenError } from '@/lib/auth/rbac'
import { suggestBridges } from '@/lib/bridges/suggest-bridge'
import { unstable_cache } from 'next/cache'

function errorResponse(err: unknown) {
  if (err instanceof AuthenticationError) {
    return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  }
  if (err instanceof ForbiddenError) {
    return NextResponse.json({ erro: err.message }, { status: 403 })
  }
  throw err
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: companyId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.view')

    // Cache 60s por (companyId, userId) — userId é parte da chave porque
    // privacidade multi-sócio retorna resultados diferentes por user
    const cached = unstable_cache(
      async () =>
        suggestBridges({
          companyId,
          userId: ctx.user.id,
        }),
      [`bridges-suggestions-${companyId}-${ctx.user.id}`],
      { revalidate: 60, tags: [`bridges:suggestions:${companyId}`] },
    )

    const candidates = await cached()

    // Mapeia pra DTO mais leve (não vaza demais)
    const items = candidates.map((c) => ({
      pjTransactionId: c.pjTransaction.id,
      pjDescription: c.pjTransaction.description,
      pjAmount: c.pjTransaction.amount,
      pjDate: c.pjTransaction.date,
      profileId: c.profile.id,
      profileName: c.profile.name,
      socioPFId: c.socioPF.id,
      socioPFNome: c.socioPF.nome,
      suggestedKind: c.suggestedKind,
      suggestedAccountId: c.suggestedAccountId,
      suggestedCategoryId: c.suggestedCategoryId,
    }))

    return NextResponse.json({ candidates: items })
  } catch (err) {
    return errorResponse(err)
  }
}
