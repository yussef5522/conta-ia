// Sprint PF Fatia 2 — Preview de parcelas sem criar a compra.
// Alimenta o componente <InstallmentPreview> no form de nova compra.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import {
  getCardInProfile,
  buildInstallments,
  isCreditCardError,
  isProfileAccessError,
} from '@/lib/credit-card/queries'
import { MAX_INSTALLMENTS } from '@/lib/credit-card/build-installments'
import { checkProfileAccess } from '@/lib/personal-profile/queries'

function errorResponse(err: unknown) {
  if (isProfileAccessError(err)) {
    return NextResponse.json(
      { erro: err.message, code: err.code },
      { status: err.code === 'NO_ACCESS' ? 404 : 403 },
    )
  }
  if (isCreditCardError(err)) {
    return NextResponse.json(
      { erro: err.message, code: err.code },
      { status: err.code === 'CARD_NOT_FOUND' ? 404 : 400 },
    )
  }
  throw err
}

const schema = z.object({
  date: z.string().datetime(),
  totalAmount: z.number().positive(),
  installments: z.number().int().min(1).max(MAX_INSTALLMENTS),
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
    await checkProfileAccess(user.sub, id)
    const card = await getCardInProfile(id, cardId)
    const rows = buildInstallments({
      purchaseDate: new Date(parsed.data.date),
      totalAmount: parsed.data.totalAmount,
      installments: parsed.data.installments,
      card: {
        closingDay: card.closingDay,
        dueDay: card.dueDay,
        closingDayRule: card.closingDayRule as 'ATUAL' | 'PROXIMA',
      },
    })
    return NextResponse.json({ installments: rows })
  } catch (err) {
    return errorResponse(err)
  }
}
