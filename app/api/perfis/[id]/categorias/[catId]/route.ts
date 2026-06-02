// Sprint PF FATIA 1 — Categoria PF (PATCH + DELETE).

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

async function assertCategoryInProfile(profileId: string, catId: string) {
  const cat = await prisma.personalCategory.findUnique({
    where: { id: catId },
    select: { profileId: true },
  })
  if (!cat || cat.profileId !== profileId) {
    throw new ProfileAccessError('Categoria não encontrada', 'NOT_FOUND')
  }
}

const patchSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  color: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; catId: string }> },
) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  const { id, catId } = await params
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
    await assertCategoryInProfile(id, catId)
    // Valida parentId se fornecido
    if (parsed.data.parentId) {
      await assertCategoryInProfile(id, parsed.data.parentId)
      if (parsed.data.parentId === catId) {
        return NextResponse.json(
          { erro: 'Categoria não pode ser pai de si mesma' },
          { status: 400 },
        )
      }
    }
    const category = await prisma.personalCategory.update({
      where: { id: catId },
      data: parsed.data,
    })
    return NextResponse.json({ category })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; catId: string }> },
) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  const { id, catId } = await params
  try {
    await checkProfileAccess(user.sub, id, 'OWNER')
    await assertCategoryInProfile(id, catId)
    await prisma.personalCategory.update({
      where: { id: catId },
      data: { isActive: false },
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}
