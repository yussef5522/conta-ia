// Sprint Gestão de Conta (31/05/2026) — POST reset-password
// Gera senha temporária + seta mustChangePassword=true.
// Retorna a senha temp UMA vez (admin copia/repassa).
//
// RBAC: OPERADOR e OWNER ambos podem resetar.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { getAdminSession, loadGerenciador } from '@/lib/admin-auth/session'
import { reAuthGerenciador } from '@/lib/admin-clientes/re-auth'
import { generateTempPassword } from '@/lib/admin-clientes/generate-temp-password'

interface Params {
  params: Promise<{ userId: string }>
}

const schema = z.object({
  gerenciadorPassword: z.string().min(1, 'Senha obrigatória'),
})

export async function POST(request: NextRequest, { params }: Params) {
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
    return NextResponse.json({ erro: 'Senha obrigatória' }, { status: 400 })
  }

  const reauth = await reAuthGerenciador(
    gerenciador.id,
    parsed.data.gerenciadorPassword,
    'reset-password',
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
    select: { id: true, email: true, name: true },
  })
  if (!user) {
    return NextResponse.json({ erro: 'Cliente não encontrado' }, { status: 404 })
  }

  // Gera senha temporária forte
  const tempPassword = generateTempPassword(16)
  const passwordHash = await bcrypt.hash(tempPassword, 12)

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { password: passwordHash, mustChangePassword: true },
    }),
    // Invalida códigos de reset pendentes (não pode reusar nada antigo)
    prisma.passwordResetCode.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.gerenciadorAuditLog.create({
      data: {
        gerenciadorId: gerenciador.id,
        action: 'ADMIN_RESET_USER_PASSWORD',
        entityType: 'User',
        entityId: userId,
        metadata: JSON.stringify({
          userEmail: user.email,
          userName: user.name,
          mustChangePassword: true,
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
    tempPassword, // ⚠️ mostrada UMA vez na UI, admin copia e repassa
    userEmail: user.email,
    userName: user.name,
  })
}
