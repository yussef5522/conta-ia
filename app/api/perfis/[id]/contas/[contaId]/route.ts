// Sprint PF FATIA 1 — Conta PF (PATCH + DELETE).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import {
  checkProfileAccess,
  ProfileAccessError,
} from '@/lib/personal-profile/queries'

function errorResponse(err: unknown) {
  if (err instanceof ProfileAccessError) {
    const status = err.code === 'NO_ACCESS' ? 404 : 403
    return NextResponse.json({ erro: err.message, code: err.code }, { status })
  }
  throw err
}

async function assertAccountInProfile(profileId: string, contaId: string) {
  const acc = await prisma.personalBankAccount.findUnique({
    where: { id: contaId },
    select: { profileId: true },
  })
  if (!acc || acc.profileId !== profileId) {
    throw new ProfileAccessError('Conta não encontrada', 'NOT_FOUND')
  }
}

const patchSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  bankName: z.string().nullable().optional(),
  bankCode: z.string().nullable().optional(),
  agency: z.string().nullable().optional(),
  accountNumber: z.string().nullable().optional(),
  accountType: z.enum(['CHECKING', 'SAVINGS', 'DIGITAL_WALLET']).optional(),
  allowNegativeBalance: z.boolean().optional(),
  creditLimit: z.number().min(0).optional(),
  lowBalanceThreshold: z.number().nullable().optional(),
  isActive: z.boolean().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; contaId: string }> },
) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  const { id, contaId } = await params
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
    await assertAccountInProfile(id, contaId)
    const account = await prisma.personalBankAccount.update({
      where: { id: contaId },
      data: parsed.data,
    })
    return NextResponse.json({ account })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; contaId: string }> },
) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  const { id, contaId } = await params
  try {
    await checkProfileAccess(user.sub, id, 'OWNER')
    await assertAccountInProfile(id, contaId)
    await prisma.personalBankAccount.update({
      where: { id: contaId },
      data: { isActive: false },
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}
