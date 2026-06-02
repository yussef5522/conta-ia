// Sprint PF FATIA 1 — GET (detalhe + summary) + PATCH + DELETE.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import {
  checkProfileAccess,
  getProfileSummary,
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
  if (!user) {
    return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  }
  const { id } = await params
  try {
    const link = await checkProfileAccess(user.sub, id)
    const [profile, summary] = await Promise.all([
      prisma.personalProfile.findUnique({ where: { id } }),
      getProfileSummary(user.sub, id),
    ])
    return NextResponse.json({
      profile,
      role: link.role,
      isSelf: link.isSelf,
      summary,
    })
  } catch (err) {
    return errorResponse(err)
  }
}

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  cpf: z.string().nullable().optional(),
  type: z.enum(['OWN', 'DEPENDENT']).optional(),
  birthDate: z.string().datetime().nullable().optional(),
  isActive: z.boolean().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  }
  const { id } = await params
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
    const updated = await prisma.personalProfile.update({
      where: { id },
      data: {
        ...(parsed.data.name !== undefined && { name: parsed.data.name }),
        ...(parsed.data.cpf !== undefined && { cpf: parsed.data.cpf }),
        ...(parsed.data.type !== undefined && { type: parsed.data.type }),
        ...(parsed.data.isActive !== undefined && { isActive: parsed.data.isActive }),
        ...(parsed.data.birthDate !== undefined && {
          birthDate: parsed.data.birthDate ? new Date(parsed.data.birthDate) : null,
        }),
      },
    })
    return NextResponse.json({ profile: updated })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  }
  const { id } = await params
  try {
    await checkProfileAccess(user.sub, id, 'OWNER')
    // Soft delete (mantém histórico). Cascade real ficaria pra fluxo dedicado.
    await prisma.personalProfile.update({
      where: { id },
      data: { isActive: false },
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}
