// Sprint PF Fatia 2 — Cartões (lista + criar).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import {
  listCardsForProfile,
  createCreditCard,
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
    return NextResponse.json({ erro: err.message, code: err.code }, { status: 400 })
  }
  throw err
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  const { id } = await params
  try {
    const cards = await listCardsForProfile(user.sub, id)
    return NextResponse.json({ cards })
  } catch (err) {
    return errorResponse(err)
  }
}

const createSchema = z.object({
  name: z.string().min(1).max(60),
  bankName: z.string().nullable().optional(),
  lastDigits: z.string().regex(/^\d{4}$/).nullable().optional(),
  brand: z.enum(['VISA', 'MASTERCARD', 'ELO', 'AMEX', 'HIPERCARD']).nullable().optional(),
  creditLimit: z.number().positive(),
  closingDay: z.number().int().min(1).max(31),
  dueDay: z.number().int().min(1).max(31),
  closingDayRule: z.enum(['ATUAL', 'PROXIMA']).optional(),
  defaultPaymentAccountId: z.string().nullable().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  const { id } = await params
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ erro: 'JSON inválido' }, { status: 400 })
  }
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { erro: parsed.error.issues[0]?.message ?? 'Dados inválidos' },
      { status: 400 },
    )
  }
  try {
    const card = await createCreditCard({
      userId: user.sub,
      profileId: id,
      ...parsed.data,
    })
    return NextResponse.json({ card }, { status: 201 })
  } catch (err) {
    return errorResponse(err)
  }
}
