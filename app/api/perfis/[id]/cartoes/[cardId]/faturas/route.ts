// Sprint PF Fatia 2 — Lista de faturas do cartão.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import {
  getCardInProfile,
  isCreditCardError,
  isProfileAccessError,
} from '@/lib/credit-card/queries'
import { checkProfileAccess } from '@/lib/personal-profile/queries'

function errorResponse(err: unknown) {
  if (isProfileAccessError(err)) {
    return NextResponse.json(
      { erro: err.message, code: err.code },
      { status: err.code === 'NO_ACCESS' ? 404 : 403 },
    )
  }
  if (isCreditCardError(err)) {
    const s = err.code === 'CARD_NOT_FOUND' || err.code === 'INVOICE_NOT_FOUND' ? 404 : 400
    return NextResponse.json({ erro: err.message, code: err.code }, { status: s })
  }
  throw err
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; cardId: string }> },
) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  const { id, cardId } = await params
  try {
    await checkProfileAccess(user.sub, id)
    await getCardInProfile(id, cardId)
    const invoices = await prisma.creditCardInvoice.findMany({
      where: { creditCardId: cardId },
      orderBy: { closingDate: 'desc' },
    })
    return NextResponse.json({ invoices })
  } catch (err) {
    return errorResponse(err)
  }
}
