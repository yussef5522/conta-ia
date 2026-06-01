// GET /api/auth/me — sessão atual
// DELETE /api/auth/me — exclui própria conta (autoatendimento)
//   Sprint Gestão de Conta (31/05/2026)

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { getAuthUser, COOKIE_NAME } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { deleteUserCascade } from '@/lib/admin-clientes/delete-user-cascade'

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.sub },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      mustChangePassword: true,
      createdAt: true,
    },
  })

  if (!dbUser) {
    return NextResponse.json({ erro: 'Usuário não encontrado' }, { status: 404 })
  }

  return NextResponse.json({ usuario: dbUser })
}

const deleteSchema = z.object({
  currentPassword: z.string().min(1, 'Senha atual obrigatória'),
  confirmText: z
    .string()
    .refine((v) => v === 'EXCLUIR', 'Digite EXCLUIR pra confirmar'),
})

export async function DELETE(request: NextRequest) {
  const sessionUser = await getAuthUser(request)
  if (!sessionUser) {
    return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ erro: 'Body JSON inválido' }, { status: 400 })
  }
  const parsed = deleteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { erro: parsed.error.issues[0]?.message ?? 'Dados inválidos' },
      { status: 400 },
    )
  }

  // Re-auth: confirma senha atual
  const user = await prisma.user.findUnique({
    where: { id: sessionUser.sub },
    select: { id: true, email: true, password: true },
  })
  if (!user) {
    return NextResponse.json({ erro: 'Usuário não encontrado' }, { status: 404 })
  }

  const valid = await bcrypt.compare(parsed.data.currentPassword, user.password)
  if (!valid) {
    return NextResponse.json(
      { erro: 'Senha atual incorreta' },
      { status: 401 },
    )
  }

  // Cascade atomic — REUSO da mesma função testada da Parte A.
  await prisma.$transaction(async (tx) => {
    await deleteUserCascade(tx, user.id)
  })

  // Limpa cookie de auth + responde sucesso
  const response = NextResponse.json({ success: true })
  response.cookies.delete(COOKIE_NAME)
  return response
}
