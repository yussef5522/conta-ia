// Sprint 5.0.3.0c ELITE — PATCH update + DELETE de SavedView.
//
// Multi-tenant: rejeita 404 se a view não pertence ao userId logado.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { savedViewUpdateSchema } from '@/lib/validations/saved-view'

interface Params {
  params: Promise<{ id: string }>
}

async function loadOwnedView(viewId: string, userId: string) {
  return prisma.savedView.findFirst({
    where: { id: viewId, userId },
  })
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const ctx = await getAuthContext(request)

    const existing = await loadOwnedView(id, ctx.user.id)
    if (!existing) {
      return NextResponse.json(
        { erro: 'View não encontrada', code: 'VIEW_NOT_FOUND' },
        { status: 404 },
      )
    }

    const body = await request.json()
    const data = savedViewUpdateSchema.parse(body)

    const updated = await prisma.savedView.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.icon !== undefined ? { icon: data.icon } : {}),
        ...(data.filters !== undefined ? { filters: data.filters } : {}),
        ...(data.sortBy !== undefined ? { sortBy: data.sortBy } : {}),
        ...(data.sortDir !== undefined ? { sortDir: data.sortDir } : {}),
        ...(data.columnOrder !== undefined
          ? { columnOrder: data.columnOrder }
          : {}),
        ...(data.columnHidden !== undefined
          ? { columnHidden: data.columnHidden }
          : {}),
        ...(data.density !== undefined ? { density: data.density } : {}),
        ...(data.pinnedOrder !== undefined
          ? { pinnedOrder: data.pinnedOrder }
          : {}),
      },
    })

    return NextResponse.json({ view: updated })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const ctx = await getAuthContext(request)

    const existing = await loadOwnedView(id, ctx.user.id)
    if (!existing) {
      return NextResponse.json(
        { erro: 'View não encontrada', code: 'VIEW_NOT_FOUND' },
        { status: 404 },
      )
    }

    await prisma.savedView.delete({ where: { id } })

    return NextResponse.json({ mensagem: 'View excluída' })
  } catch (error) {
    return handleApiError(error)
  }
}
