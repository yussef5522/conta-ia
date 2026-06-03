// Sprint PF Fatia 2 — Pagar fatura (total/parcial + juros opcional).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import {
  payInvoice,
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
      INVOICE_NOT_FOUND: 404,
      INVALID_ACCOUNT: 400,
      INVALID_PAYMENT_AMOUNT: 400,
      ALREADY_PAID: 409,
      OVERPAY: 400,
    }
    return NextResponse.json(
      { erro: err.message, code: err.code },
      { status: map[err.code] ?? 400 },
    )
  }
  throw err
}

const schema = z.object({
  paymentAccountId: z.string().min(1),
  amount: z.number().positive(),
  juros: z.number().min(0).optional().nullable(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; cardId: string; invoiceId: string }> },
) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  const { id, cardId, invoiceId } = await params
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
    const result = await payInvoice({
      userId: user.sub,
      profileId: id,
      cardId,
      invoiceId,
      paymentAccountId: parsed.data.paymentAccountId,
      amount: parsed.data.amount,
      juros: parsed.data.juros ?? null,
    })
    return NextResponse.json(result)
  } catch (err) {
    return errorResponse(err)
  }
}
