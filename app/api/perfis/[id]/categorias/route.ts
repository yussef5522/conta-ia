// Sprint PF FATIA 1 — Categorias PF (lista + criar).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import {
  listCategoriesForProfile,
  createCategory,
  ProfileAccessError,
} from '@/lib/personal-profile/queries'

function errorResponse(err: unknown) {
  if (err instanceof ProfileAccessError) {
    const map: Record<string, number> = {
      NO_ACCESS: 404,
      INSUFFICIENT_ROLE: 403,
      INVALID_PARENT: 400,
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
  try {
    const categories = await listCategoriesForProfile(user.sub, id)
    return NextResponse.json({ categories })
  } catch (err) {
    return errorResponse(err)
  }
}

const createSchema = z.object({
  name: z.string().min(1).max(60),
  type: z.enum(['INCOME', 'EXPENSE']),
  color: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
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
    const category = await createCategory({
      userId: user.sub,
      profileId: id,
      ...parsed.data,
    })
    return NextResponse.json({ category }, { status: 201 })
  } catch (err) {
    return errorResponse(err)
  }
}
