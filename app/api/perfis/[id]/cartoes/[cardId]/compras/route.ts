// Sprint PF Fatia 2 — Nova compra no cartão (à vista ou parcelada).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import {
  createPurchase,
  isCreditCardError,
  isProfileAccessError,
} from '@/lib/credit-card/queries'
import { MAX_INSTALLMENTS } from '@/lib/credit-card/build-installments'

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
      INVALID_CATEGORY: 400,
      INVALID_AMOUNT: 400,
    }
    return NextResponse.json(
      { erro: err.message, code: err.code },
      { status: map[err.code] ?? 400 },
    )
  }
  throw err
}

const schema = z.object({
  date: z.string().datetime(),
  description: z.string().min(1).max(200),
  totalAmount: z.number().positive(),
  installments: z.number().int().min(1).max(MAX_INSTALLMENTS),
  categoryId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; cardId: string }> },
) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  const { id, cardId } = await params
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ erro: 'JSON inválido' }, { status: 400 })
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { erro: parsed.error.issues[0]?.message ?? 'Dados inválidos' },
      { status: 400 },
    )
  }
  try {
    const result = await createPurchase({
      userId: user.sub,
      profileId: id,
      cardId,
      date: new Date(parsed.data.date),
      description: parsed.data.description,
      totalAmount: parsed.data.totalAmount,
      installments: parsed.data.installments,
      categoryId: parsed.data.categoryId ?? null,
      notes: parsed.data.notes ?? null,
    })
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    return errorResponse(err)
  }
}
