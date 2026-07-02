// Sprint Despesas-PF (02/07/2026).
//
// POST /api/perfis/[id]/despesas/recategorizar
// Body: { transactionIds: string[], novaCategoriaId: string | null }
//
// Move N tx PF pra nova categoria em batch. Semantics:
//   - novaCategoriaId=null → tira categoria (fica "Sem categoria")
//   - novaCategoriaId=X → sobrescreve, marca classifiedBy='MANUAL',
//     aiConfidence=1.0
//
// PF nasce sempre RECONCILED por design (Fatia 3) — recategorizar
// não muda status.
//
// SEM revalidateTag — tela /despesas nasce sem `unstable_cache` (lição
// Fix-Cache-Despesas 01/07). Cabeçalho e lista sempre real-time.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import {
  checkProfileAccess,
  ProfileAccessError,
} from '@/lib/personal-profile/queries'

const schema = z.object({
  transactionIds: z.array(z.string().cuid()).min(1).max(500),
  novaCategoriaId: z.string().cuid().nullable(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: profileId } = await params
    const ctx = await getAuthContext(request)

    // Guard OWNER-only (mesmo padrão dos outros endpoints /api/perfis)
    await checkProfileAccess(ctx.user.id, profileId, 'OWNER')

    const body = await request.json()
    const input = schema.parse(body)

    // Se novaCategoriaId != null, valida que pertence a este perfil
    if (input.novaCategoriaId) {
      const cat = await prisma.personalCategory.findFirst({
        where: {
          id: input.novaCategoriaId,
          profileId,
          isActive: true,
        },
        select: { id: true, name: true, color: true },
      })
      if (!cat) {
        return NextResponse.json(
          { erro: 'Categoria não encontrada neste perfil' },
          { status: 404 },
        )
      }
    }

    // Guarda IDs originais + suas categorias antigas pro undo (client-side)
    const antigas = await prisma.personalTransaction.findMany({
      where: {
        id: { in: input.transactionIds },
        profileId, // multi-tenant guard
      },
      select: { id: true, categoryId: true },
    })
    const previousByTxId = new Map(antigas.map((t) => [t.id, t.categoryId]))
    const ownedIds = antigas.map((t) => t.id)

    if (ownedIds.length === 0) {
      return NextResponse.json({ updated: 0, requested: input.transactionIds.length })
    }

    // Batch UPDATE atomic
    const result = await prisma.personalTransaction.updateMany({
      where: { id: { in: ownedIds }, profileId },
      data: {
        categoryId: input.novaCategoriaId,
        classifiedBy: 'MANUAL',
        aiConfidence: input.novaCategoriaId ? 1.0 : null,
      },
    })

    return NextResponse.json({
      updated: result.count,
      requested: input.transactionIds.length,
      skippedNotOwned: input.transactionIds.length - ownedIds.length,
      previousByTxId: Object.fromEntries(previousByTxId),
    })
  } catch (err) {
    if (err instanceof ProfileAccessError) {
      return NextResponse.json({ erro: err.message }, { status: 403 })
    }
    return handleApiError(err)
  }
}
