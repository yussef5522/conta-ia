// Sprint PF Fatia 2 — Cartão (detalhe + editar + soft delete).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import {
  getCardInProfile,
  getCardSummary,
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
    const s = err.code === 'CARD_NOT_FOUND' ? 404 : 400
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
    const card = await getCardInProfile(id, cardId)
    const summary = await getCardSummary(user.sub, id, cardId)
    return NextResponse.json({ card, summary })
  } catch (err) {
    return errorResponse(err)
  }
}

const patchSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  bankName: z.string().nullable().optional(),
  lastDigits: z.string().regex(/^\d{4}$/).nullable().optional(),
  brand: z.enum(['VISA', 'MASTERCARD', 'ELO', 'AMEX', 'HIPERCARD']).nullable().optional(),
  creditLimit: z.number().positive().optional(),
  closingDay: z.number().int().min(1).max(31).optional(),
  dueDay: z.number().int().min(1).max(31).optional(),
  closingDayRule: z.enum(['ATUAL', 'PROXIMA']).optional(),
  defaultPaymentAccountId: z.string().nullable().optional(),
})

export async function PATCH(
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
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { erro: parsed.error.issues[0]?.message ?? 'Dados inválidos' },
      { status: 400 },
    )
  }
  try {
    await checkProfileAccess(user.sub, id, 'OWNER')
    await getCardInProfile(id, cardId)
    // closingDay !== dueDay check
    const willClose = parsed.data.closingDay
    const willDue = parsed.data.dueDay
    if (willClose !== undefined && willDue !== undefined && willClose === willDue) {
      return NextResponse.json(
        { erro: 'Fechamento e vencimento não podem ser o mesmo dia' },
        { status: 400 },
      )
    }
    // Valida defaultPaymentAccountId pertence ao perfil
    if (parsed.data.defaultPaymentAccountId) {
      const acc = await prisma.personalBankAccount.findUnique({
        where: { id: parsed.data.defaultPaymentAccountId },
        select: { profileId: true },
      })
      if (!acc || acc.profileId !== id) {
        return NextResponse.json(
          { erro: 'Conta de pagamento inválida' },
          { status: 400 },
        )
      }
    }
    const card = await prisma.creditCard.update({
      where: { id: cardId },
      data: parsed.data,
    })
    return NextResponse.json({ card })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; cardId: string }> },
) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  const { id, cardId } = await params
  try {
    await checkProfileAccess(user.sub, id, 'OWNER')
    await getCardInProfile(id, cardId)
    await prisma.creditCard.update({
      where: { id: cardId },
      data: { isActive: false },
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}
