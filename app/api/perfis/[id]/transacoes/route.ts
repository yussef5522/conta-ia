// Sprint PF FATIA 1 — Transações PF (lista filtrável + criar).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import {
  listTransactions,
  createTransaction,
  ProfileAccessError,
} from '@/lib/personal-profile/queries'

function errorResponse(err: unknown) {
  if (err instanceof ProfileAccessError) {
    const map: Record<string, number> = {
      NO_ACCESS: 404,
      INSUFFICIENT_ROLE: 403,
      INVALID_ACCOUNT: 400,
      INVALID_CATEGORY: 400,
    }
    return NextResponse.json(
      { erro: err.message, code: err.code },
      { status: map[err.code] ?? 403 },
    )
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
  const sp = request.nextUrl.searchParams
  try {
    const result = await listTransactions({
      userId: user.sub,
      profileId: id,
      startDate: sp.get('startDate') ? new Date(sp.get('startDate')!) : null,
      endDate: sp.get('endDate') ? new Date(sp.get('endDate')!) : null,
      type: (sp.get('type') as 'CREDIT' | 'DEBIT' | null) || null,
      categoryId: sp.get('categoryId'),
      bankAccountId: sp.get('bankAccountId'),
      search: sp.get('q'),
      page: sp.get('page') ? Number(sp.get('page')) : 1,
      pageSize: sp.get('pageSize') ? Number(sp.get('pageSize')) : 50,
    })
    return NextResponse.json(result)
  } catch (err) {
    return errorResponse(err)
  }
}

const createSchema = z.object({
  date: z.string().datetime(),
  description: z.string().min(1).max(200),
  amount: z.number().positive(),
  type: z.enum(['CREDIT', 'DEBIT']),
  bankAccountId: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
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
    const transaction = await createTransaction({
      userId: user.sub,
      profileId: id,
      date: new Date(parsed.data.date),
      description: parsed.data.description,
      amount: parsed.data.amount,
      type: parsed.data.type,
      bankAccountId: parsed.data.bankAccountId,
      categoryId: parsed.data.categoryId,
      notes: parsed.data.notes,
    })
    return NextResponse.json({ transaction }, { status: 201 })
  } catch (err) {
    return errorResponse(err)
  }
}
