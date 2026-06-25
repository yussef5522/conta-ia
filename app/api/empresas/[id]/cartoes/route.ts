// Sprint Cartao Credito PJ (24/06/2026) — CRUD /api/empresas/[id]/cartoes
//
// GET  -> lista cartoes da empresa + agregados (gasto do mes, % limite)
// POST -> cria cartao

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { listCardsForCompany } from '@/lib/credit-card-pj/queries'

interface Params { params: Promise<{ id: string }> }

async function verificarEmpresa(userId: string, companyId: string) {
  return prisma.userCompany.findFirst({
    where: { userId, companyId },
    select: { companyId: true },
  })
}

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json(
      { erro: 'Sessão expirada ou não autenticado', code: 'AUTH_REQUIRED' },
      { status: 401 },
    )
  }
  const acesso = await verificarEmpresa(user.sub, companyId)
  if (!acesso) {
    return NextResponse.json({ erro: 'Empresa não encontrada' }, { status: 404 })
  }
  const cards = await listCardsForCompany(companyId)
  return NextResponse.json({ cards })
}

const createSchema = z.object({
  name: z.string().min(1).max(80),
  bankName: z.string().max(60).nullable().optional(),
  brand: z.string().max(30).nullable().optional(),
  lastDigits: z.string().regex(/^\d{2,6}$/).nullable().optional(),
  creditLimit: z.coerce.number().positive(),
  closingDay: z.coerce.number().int().min(1).max(31),
  dueDay: z.coerce.number().int().min(1).max(31),
  closingDayRule: z.enum(['ATUAL', 'PROXIMA']).default('ATUAL'),
  defaultPaymentBankAccountId: z.string().cuid().nullable().optional(),
})

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json(
      { erro: 'Sessão expirada ou não autenticado', code: 'AUTH_REQUIRED' },
      { status: 401 },
    )
  }
  const acesso = await verificarEmpresa(user.sub, companyId)
  if (!acesso) {
    return NextResponse.json({ erro: 'Empresa não encontrada' }, { status: 404 })
  }

  let data
  try {
    data = createSchema.parse(await request.json())
  } catch (err) {
    return NextResponse.json(
      { erro: 'Dados inválidos', details: err instanceof z.ZodError ? err.issues : String(err) },
      { status: 400 },
    )
  }

  // Valida bankAccountId default (se enviado, tem que ser da mesma empresa)
  if (data.defaultPaymentBankAccountId) {
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

  const card = await prisma.businessCreditCard.create({
    data: {
      companyId,
      name: data.name,
      bankName: data.bankName ?? null,
      brand: data.brand ?? null,
      lastDigits: data.lastDigits ?? null,
      creditLimit: data.creditLimit,
      closingDay: data.closingDay,
      dueDay: data.dueDay,
      closingDayRule: data.closingDayRule,
      defaultPaymentBankAccountId: data.defaultPaymentBankAccountId ?? null,
    },
  })
  return NextResponse.json({ card }, { status: 201 })
}
