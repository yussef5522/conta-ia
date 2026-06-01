// Sprint Gestão de Conta (31/05/2026) — POST troca de senha do user logado.
//
// 2 fluxos atendidos pelo mesmo endpoint:
//   (1) AUTOATENDIMENTO (mustChangePassword=false):
//       Exige `currentPassword` + `novaSenha`. Bcrypt compare na atual.
//   (2) FORCE CHANGE (mustChangePassword=true após reset admin):
//       Login já validou a senha temporária — exige só `novaSenha`.
//       `currentPassword` é IGNORADO se vier.
//
// Após sucesso: zera mustChangePassword + REGENERA o cookie auth_token
// com payload limpo (flag false) → middleware libera o app.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { getAuthUser, signToken, COOKIE_NAME, COOKIE_OPTIONS } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { checkPasswordStrength } from '@/lib/auth/password-reset'

const schema = z.object({
  currentPassword: z.string().optional(),
  novaSenha: z.string().min(8, 'Senha precisa ter ao menos 8 caracteres'),
})

export async function POST(request: NextRequest) {
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
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { erro: parsed.error.issues[0]?.message ?? 'Dados inválidos' },
      { status: 400 },
    )
  }

  // Validação de força da nova senha (mesmo critério do reset-password legacy)
  const strength = checkPasswordStrength(parsed.data.novaSenha)
  if (!strength.ok) {
    return NextResponse.json(
      { erro: strength.errors[0] ?? 'Senha fraca' },
      { status: 400 },
    )
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.sub },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      password: true,
      mustChangePassword: true,
    },
  })
  if (!user) {
    return NextResponse.json({ erro: 'Usuário não encontrado' }, { status: 404 })
  }

  // Fluxo de AUTOATENDIMENTO exige bcrypt compare da senha atual.
  // Fluxo de FORCE-CHANGE pula (login já validou a senha temp).
  if (!user.mustChangePassword) {
    if (!parsed.data.currentPassword) {
      return NextResponse.json(
        { erro: 'Senha atual obrigatória' },
        { status: 400 },
      )
    }
    const valid = await bcrypt.compare(
      parsed.data.currentPassword,
      user.password,
    )
    if (!valid) {
      return NextResponse.json(
        { erro: 'Senha atual incorreta' },
        { status: 401 },
      )
    }
  }

  const newHash = await bcrypt.hash(parsed.data.novaSenha, 12)

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { password: newHash, mustChangePassword: false },
    }),
    // Invalida códigos de reset pendentes (não dá pra reusar)
    prisma.passwordResetCode.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    }),
  ])

  // Regenera cookie limpo (sem mustChangePassword)
  const newToken = await signToken({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    mustChangePassword: false,
  })

  const response = NextResponse.json({ success: true })
  response.cookies.set(COOKIE_NAME, newToken, COOKIE_OPTIONS)
  return response
}
