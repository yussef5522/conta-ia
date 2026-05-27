// Sprint 5.0.3.0c ELITE — POST duplicate de SavedView.
// Cria nova view com mesmos campos + name " (cópia)".

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const ctx = await getAuthContext(request)

    const source = await prisma.savedView.findFirst({
      where: { id, userId: ctx.user.id },
    })
    if (!source) {
      return NextResponse.json(
        { erro: 'View não encontrada', code: 'VIEW_NOT_FOUND' },
        { status: 404 },
      )
    }

    // Nome único — encontra próximo disponível (cópia, cópia 2, ...)
    let baseName = `${source.name} (cópia)`
    let counter = 2
    while (
      await prisma.savedView.findFirst({
        where: {
          userId: ctx.user.id,
          empresaId: source.empresaId,
          scope: source.scope,
          name: baseName,
        },
      })
    ) {
      baseName = `${source.name} (cópia ${counter})`
      counter++
      if (counter > 100) {
        return NextResponse.json(
          { erro: 'Limite de cópias atingido', code: 'TOO_MANY_COPIES' },
          { status: 422 },
        )
      }
    }

    const maxOrder = await prisma.savedView.findFirst({
      where: {
        userId: ctx.user.id,
        empresaId: source.empresaId,
        scope: source.scope,
      },
      orderBy: { pinnedOrder: 'desc' },
      select: { pinnedOrder: true },
    })

    const nova = await prisma.savedView.create({
      data: {
        userId: ctx.user.id,
        empresaId: source.empresaId,
        scope: source.scope,
        name: baseName,
        icon: source.icon,
        filters: source.filters,
        sortBy: source.sortBy,
        sortDir: source.sortDir,
        columnOrder: source.columnOrder,
        columnHidden: source.columnHidden,
        density: source.density,
        pinnedOrder: (maxOrder?.pinnedOrder ?? 0) + 1,
      },
    })

    return NextResponse.json({ view: nova }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
