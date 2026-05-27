// Sprint 5.0.3.0c ELITE — PATCH batch reorder de SavedView.
// Body: { scope, empresaId?, ids: [id1, id2, id3, ...] }
// Aplica pinnedOrder = index pra cada id (atomicamente).

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { savedViewReorderSchema } from '@/lib/validations/saved-view'

export async function PATCH(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request)
    const body = await request.json()
    const data = savedViewReorderSchema.parse(body)

    // Verifica que TODAS as IDs pertencem ao userId (multi-tenant guard)
    const owned = await prisma.savedView.findMany({
      where: {
        id: { in: data.ids },
        userId: ctx.user.id,
        empresaId: data.empresaId ?? null,
        scope: data.scope,
      },
      select: { id: true },
    })
    if (owned.length !== data.ids.length) {
      return NextResponse.json(
        {
          erro: 'Uma ou mais views não pertencem ao usuário ou ao escopo',
          code: 'REORDER_OWNERSHIP_MISMATCH',
        },
        { status: 403 },
      )
    }

    // Atualiza pinnedOrder atomicamente
    await prisma.$transaction(
      data.ids.map((id, index) =>
        prisma.savedView.update({
          where: { id },
          data: { pinnedOrder: index },
        }),
      ),
    )

    return NextResponse.json({ reordered: data.ids.length })
  } catch (error) {
    return handleApiError(error)
  }
}
