// Sprint Cartao Credito PJ (24/06/2026) — detalhe/edit/delete cartao

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getCardDashboard } from '@/lib/credit-card-pj/queries'

interface Params { params: Promise<{ id: string; cardId: string }> }

async function verificarAcesso(userId: string, companyId: string, cardId: string) {
  const company = await prisma.userCompany.findFirst({
    where: { userId, companyId },
    select: { companyId: true },
  })
  if (!company) return null
  return prisma.businessCreditCard.findFirst({
    where: { id: cardId, companyId },
  })
}

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId, cardId } = await params
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json(
      { erro: 'Sessão expirada ou não autenticado', code: 'AUTH_REQUIRED' },
      { status: 401 },
    )
  }
  const card = await verificarAcesso(user.sub, companyId, cardId)
  if (!card) {
    return NextResponse.json({ erro: 'Cartão não encontrado' }, { status: 404 })
  }
  const dashboard = await getCardDashboard(companyId, cardId)
  return NextResponse.json(dashboard)
}

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  bankName: z.string().max(60).nullable().optional(),
  brand: z.string().max(30).nullable().optional(),
  lastDigits: z.string().regex(/^\d{2,6}$/).nullable().optional(),
  creditLimit: z.coerce.number().positive().optional(),
  closingDay: z.coerce.number().int().min(1).max(31).optional(),
  dueDay: z.coerce.number().int().min(1).max(31).optional(),
  closingDayRule: z.enum(['ATUAL', 'PROXIMA']).optional(),
  defaultPaymentBankAccountId: z.string().cuid().nullable().optional(),
  isActive: z.boolean().optional(),
})

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id: companyId, cardId } = await params
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json(
      { erro: 'Sessão expirada ou não autenticado', code: 'AUTH_REQUIRED' },
      { status: 401 },
    )
  }
  const card = await verificarAcesso(user.sub, companyId, cardId)
  if (!card) {
    return NextResponse.json({ erro: 'Cartão não encontrado' }, { status: 404 })
  }

  let data
  try {
    data = patchSchema.parse(await request.json())
  } catch (err) {
    return NextResponse.json(
      { erro: 'Dados inválidos', details: err instanceof z.ZodError ? err.issues : String(err) },
      { status: 400 },
    )
  }

  if (data.defaultPaymentBankAccountId !== undefined && data.defaultPaymentBankAccountId !== null) {
    const ba = await prisma.bankAccount.findFirst({
      where: { id: data.defaultPaymentBankAccountId, companyId },
      select: { id: true },
    })
    if (!ba) {
      return NextResponse.json(
        { erro: 'Conta bancária padrão inválida' },
        { status: 400 },
      )
    }
  }

  const updated = await prisma.businessCreditCard.update({
    where: { id: cardId },
    data,
  })
  return NextResponse.json({ card: updated })
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { id: companyId, cardId } = await params
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json(
      { erro: 'Sessão expirada ou não autenticado', code: 'AUTH_REQUIRED' },
      { status: 401 },
    )
  }
  const card = await verificarAcesso(user.sub, companyId, cardId)
  if (!card) {
    return NextResponse.json({ erro: 'Cartão não encontrado' }, { status: 404 })
  }

  // Soft delete: isActive=false. Hard delete só se nao tem tx.
  const txCount = await prisma.transaction.count({
    where: { businessCreditCardId: cardId },
  })
  if (txCount > 0) {
    await prisma.businessCreditCard.update({
      where: { id: cardId },
      data: { isActive: false },
    })
    return NextResponse.json({ softDeleted: true, txCount })
  }

  await prisma.businessCreditCard.delete({ where: { id: cardId } })
  return NextResponse.json({ deleted: true })
}
