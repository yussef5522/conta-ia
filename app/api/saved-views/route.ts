// Sprint 5.0.3.0c ELITE — GET list + POST create de SavedView.
//
// Multi-tenant: usuário só vê SUAS views (escopo por userId).
// `empresaId` opcional — null = view "global" do usuário (todas empresas).

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { savedViewCreateSchema } from '@/lib/validations/saved-view'

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const empresaId = sp.get('empresaId')
    const scope = sp.get('scope') ?? 'payable'

    // Se empresaId fornecido, valida acesso (multi-tenant via auth context)
    const ctx = empresaId
      ? await getAuthContext(request, empresaId)
      : await getAuthContext(request)

    const views = await prisma.savedView.findMany({
      where: {
        userId: ctx.user.id,
        // Inclui views globais (empresaId null) E da empresa específica
        ...(empresaId
          ? { OR: [{ empresaId }, { empresaId: null }] }
          : { empresaId: null }),
        scope,
      },
      orderBy: [{ pinnedOrder: 'asc' }, { createdAt: 'asc' }],
    })

    return NextResponse.json({ views })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = savedViewCreateSchema.parse(body)

    const ctx = data.empresaId
      ? await getAuthContext(request, data.empresaId)
      : await getAuthContext(request)

    // Próxima posição (após a maior atual)
    const maxOrder = await prisma.savedView.findFirst({
      where: { userId: ctx.user.id, empresaId: data.empresaId ?? null, scope: data.scope },
      orderBy: { pinnedOrder: 'desc' },
      select: { pinnedOrder: true },
    })
    const nextOrder = (maxOrder?.pinnedOrder ?? -1) + 1

    const view = await prisma.savedView.create({
      data: {
        userId: ctx.user.id,
        empresaId: data.empresaId ?? null,
        scope: data.scope,
        name: data.name,
        icon: data.icon ?? null,
        filters: data.filters,
        sortBy: data.sortBy ?? null,
        sortDir: data.sortDir ?? null,
        columnOrder: data.columnOrder ?? '[]',
        columnHidden: data.columnHidden ?? '[]',
        density: data.density,
        pinnedOrder: data.pinnedOrder || nextOrder,
      },
    })

    return NextResponse.json({ view }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
