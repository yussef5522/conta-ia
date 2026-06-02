// Sprint PF FATIA 1 — Contas bancárias PF (lista + criar).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import {
  listAccountsForProfile,
  createAccount,
  ProfileAccessError,
} from '@/lib/personal-profile/queries'

function errorResponse(err: unknown) {
  if (err instanceof ProfileAccessError) {
    const status = err.code === 'NO_ACCESS' ? 404 : 403
    return NextResponse.json({ erro: err.message, code: err.code }, { status })
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
    const accounts = await listAccountsForProfile(user.sub, id)
    return NextResponse.json({ accounts })
  } catch (err) {
    return errorResponse(err)
  }
}

const createSchema = z.object({
  name: z.string().min(1).max(60),
  bankName: z.string().nullable().optional(),
  bankCode: z.string().nullable().optional(),
  agency: z.string().nullable().optional(),
  accountNumber: z.string().nullable().optional(),
  accountType: z.enum(['CHECKING', 'SAVINGS', 'DIGITAL_WALLET']).optional(),
  balance: z.number().optional(),
  allowNegativeBalance: z.boolean().optional(),
  creditLimit: z.number().min(0).optional(),
  lowBalanceThreshold: z.number().nullable().optional(),
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
    const account = await createAccount({
      userId: user.sub,
      profileId: id,
      ...parsed.data,
    })
    return NextResponse.json({ account }, { status: 201 })
  } catch (err) {
    return errorResponse(err)
  }
}
