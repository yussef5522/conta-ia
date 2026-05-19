// POST /api/auth/reset-password
// Sprint 1.5 — redefine a senha usando o token JWT scope=password-reset.
//
// Atomicidade:
//   1. Verifica token → user.id
//   2. Valida senha forte
//   3. Hash bcrypt
//   4. Update User.password
//   5. Marca TODOS os PasswordResetCodes não-usados como usedAt
//      (impede reuso de outros códigos pendentes)
// Audit: PASSWORD_RESET_COMPLETED.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import {
  verifyResetToken,
  checkPasswordStrength,
} from '@/lib/auth/password-reset'

const schema = z.object({
  token: z.string().min(20, 'Token inválido'),
  novaSenha: z.string().min(8, 'Senha precisa ter ao menos 8 caracteres'),
})

export async function POST(request: NextRequest) {
  let parsed: { token: string; novaSenha: string }
  try {
    const body = await request.json()
    parsed = schema.parse(body)
  } catch {
    return NextResponse.json(
      { erro: 'Dados inválidos', success: false },
      { status: 400 },
    )
  }

  // Verifica strength server-side (mesmo critério do client)
  const strength = checkPasswordStrength(parsed.novaSenha)
  if (!strength.ok) {
    return NextResponse.json(
      { erro: strength.errors[0] ?? 'Senha fraca', success: false },
      { status: 400 },
    )
  }

  // Verifica JWT
  let payload: { sub: string; email: string }
  try {
    const verified = await verifyResetToken(parsed.token)
    payload = { sub: verified.sub, email: verified.email }
  } catch {
    return NextResponse.json(
      {
        erro:
          'Sessão de redefinição expirada. Solicite um novo código.',
        success: false,
      },
      { status: 401 },
    )
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, name: true },
  })
  if (!user || user.email !== payload.email) {
    return NextResponse.json(
      { erro: 'Token inválido', success: false },
      { status: 400 },
    )
  }

  // Hash + atomic update
  const passwordHash = await bcrypt.hash(parsed.novaSenha, 12)
  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    null
  const userAgent = request.headers.get('user-agent') ?? null

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { password: passwordHash },
    }),
    prisma.passwordResetCode.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    }),
  ])

  // Audit
  const audit = await prisma.userCompany.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
    select: { companyId: true },
  })
  if (audit) {
    await prisma.auditLog
      .create({
        data: {
          companyId: audit.companyId,
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          action: 'PASSWORD_RESET_COMPLETED',
          entityType: 'User',
          entityId: user.id,
          ipAddress,
          userAgent,
        },
      })
      .catch(() => null)
  }

  return NextResponse.json({ success: true })
}
