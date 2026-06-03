// Sprint PF Fatia 4 — GET detalhe + DELETE da ponte.
//
// Privacidade: getBridgeDetail e deleteBridge já fazem o checkProfileAccess
// + check createdById internamente. Não-dono nem criador → 404.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthContext, AuthenticationError, ForbiddenError } from '@/lib/auth/rbac'
import { getBridgeDetail } from '@/lib/bridges/queries'
import { deleteBridge } from '@/lib/bridges/delete'
import { isBridgeError, type BridgeDeleteMode } from '@/lib/bridges/types'

function errorResponse(err: unknown) {
  if (err instanceof AuthenticationError) {
    return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  }
  if (err instanceof ForbiddenError) {
    return NextResponse.json({ erro: err.message }, { status: 403 })
  }
  if (isBridgeError(err)) {
    const map: Record<string, number> = {
      BRIDGE_NOT_FOUND: 404,
      INVALID_MODE: 400,
    }
    return NextResponse.json(
      { erro: err.message, code: err.code },
      { status: map[err.code] ?? 400 },
    )
  }
  throw err
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const ctx = await getAuthContext(request)
    const detail = await getBridgeDetail(ctx.user.id, id)
    return NextResponse.json(detail)
  } catch (err) {
    return errorResponse(err)
  }
}

const deleteSchema = z.object({
  mode: z.enum(['LINK_ONLY', 'WITH_PF_TX']),
})

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const ctx = await getAuthContext(request)

    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode') ?? ''
    const parsed = deleteSchema.safeParse({ mode })
    if (!parsed.success) {
      return NextResponse.json(
        { erro: 'mode inválido — use LINK_ONLY ou WITH_PF_TX', code: 'INVALID_MODE' },
        { status: 400 },
      )
    }

    const result = await deleteBridge({
      userId: ctx.user.id,
      bridgeId: id,
      mode: parsed.data.mode as BridgeDeleteMode,
    })
    return NextResponse.json(result)
  } catch (err) {
    return errorResponse(err)
  }
}
