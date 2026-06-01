// Sprint Gestão de Conta (31/05/2026) — PATCH change email
// Admin corrige email do cliente (digitação errada no cadastro).
// Validações: formato Zod + unicidade.
//
// RBAC: OPERADOR e OWNER ambos podem trocar email.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAdminSession, loadGerenciador } from '@/lib/admin-auth/session'
import { reAuthGerenciador } from '@/lib/admin-clientes/re-auth'

interface Params {
  params: Promise<{ userId: string }>
}

const schema = z.object({
  gerenciadorPassword: z.string().min(1, 'Senha obrigatória'),
  newEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email('Email inválido')
    .max(200, 'Email muito longo'),
})

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  const gerenciador = await loadGerenciador(session.gerenciadorId)
  if (!gerenciador || !gerenciador.active) {
    return NextResponse.json({ erro: 'Gerenciador inativo' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ erro: 'Body JSON inválido' }, { status: 400 })
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { erro: parsed.error.issues[0]?.message ?? 'Dados inválidos' },
      { status: 400 },
    )
  }

  const reauth = await reAuthGerenciador(
    gerenciador.id,
    parsed.data.gerenciadorPassword,
    'change-email',
  )
  if (!reauth.ok) {
    if (reauth.code === 'RATE_LIMITED') {
      return NextResponse.json(
        {
          erro: 'Muitas tentativas. Aguarde antes de tentar novamente.',
          retryAfterMs: reauth.retryAfterMs,
        },
        { status: 429 },
      )
    }
    return NextResponse.json(
      { erro: 'Senha do gerenciador incorreta' },
      { status: 401 },
    )
  }

  const { userId } = await params
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  })
  if (!user) {
    return NextResponse.json({ erro: 'Cliente não encontrado' }, { status: 404 })
  }

  const newEmail = parsed.data.newEmail
  if (newEmail === user.email.toLowerCase()) {
    return NextResponse.json(
      { erro: 'O novo email é igual ao atual' },
      { status: 400 },
    )
  }

  // Unicidade: rejeita se já existe outro user com este email
  const existing = await prisma.user.findUnique({
    where: { email: newEmail },
    select: { id: true },
  })
  if (existing && existing.id !== userId) {
    return NextResponse.json(
      {
        erro: 'Já existe um cliente com este email',
        code: 'EMAIL_ALREADY_EXISTS',
      },
      { status: 409 },
    )
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { email: newEmail },
    }),
    prisma.gerenciadorAuditLog.create({
      data: {
        gerenciadorId: gerenciador.id,
        action: 'ADMIN_CHANGE_USER_EMAIL',
        entityType: 'User',
        entityId: userId,
        metadata: JSON.stringify({
          oldEmail: user.email,
          newEmail,
        }),
        ipAddress:
          request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
          request.headers.get('x-real-ip') ??
          null,
        userAgent: request.headers.get('user-agent') ?? null,
      },
    }),
  ])

  return NextResponse.json({
    success: true,
    oldEmail: user.email,
    newEmail,
  })
}
