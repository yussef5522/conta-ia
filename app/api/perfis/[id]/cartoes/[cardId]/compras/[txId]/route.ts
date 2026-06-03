// Sprint PF Fatia 2 — Estornar compra (scope SINGLE ou ALL_GROUP).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import {
  deletePurchase,
  isCreditCardError,
  isProfileAccessError,
} from '@/lib/credit-card/queries'

function errorResponse(err: unknown) {
  if (isProfileAccessError(err)) {
    return NextResponse.json(
      { erro: err.message, code: err.code },
      { status: err.code === 'NO_ACCESS' ? 404 : 403 },
    )
  }
  if (isCreditCardError(err)) {
    const map: Record<string, number> = {
      CARD_NOT_FOUND: 404,
      TX_NOT_FOUND: 404,
      TX_NOT_CARD: 400,
    }
    return NextResponse.json(
      { erro: err.message, code: err.code },
      { status: map[err.code] ?? 400 },
    )
  }
  throw err
}

const schema = z.object({
  scope: z.enum(['SINGLE', 'ALL_GROUP']).default('SINGLE'),
})

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; cardId: string; txId: string }> },
) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  const { id, cardId, txId } = await params

  // scope vem em querystring (?scope=ALL_GROUP)
  const sp = request.nextUrl.searchParams
  const parsed = schema.safeParse({ scope: sp.get('scope') ?? 'SINGLE' })
  if (!parsed.success) {
    return NextResponse.json({ erro: 'scope inválido' }, { status: 400 })
  }
  try {
    const result = await deletePurchase({
      userId: user.sub,
      profileId: id,
      cardId,
      txId,
      scope: parsed.data.scope,
    })
    return NextResponse.json(result)
  } catch (err) {
    return errorResponse(err)
  }
}
