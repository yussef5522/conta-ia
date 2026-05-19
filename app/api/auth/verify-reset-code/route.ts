// POST /api/auth/verify-reset-code
// Sprint 1.5 — verifica código 6 dígitos + emite JWT scope=password-reset.
//
// Anti-enumeration: erros genéricos.
// Brute-force: cada PasswordResetCode tem 5 attempts antes de invalidar.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import {
  verifyCode,
  signResetToken,
} from '@/lib/auth/password-reset'
import {
  checkVerifyLimit,
  MAX_CODE_ATTEMPTS_PER_CODE,
} from '@/lib/security/forgot-password-rate-limit'

const schema = z.object({
  email: z.string().email('Email inválido').toLowerCase(),
  code: z.string().regex(/^[0-9]{6}$/, 'Código deve ter 6 dígitos'),
})

const GENERIC_INVALID = 'Código inválido ou expirado'

export async function POST(request: NextRequest) {
  let email: string
  let code: string
  try {
    const body = await request.json()
    const data = schema.parse(body)
    email = data.email
    code = data.code
  } catch {
    return NextResponse.json(
      { erro: 'Dados inválidos', success: false },
      { status: 400 },
    )
  }

  // Rate limit anti-spray
  const limit = checkVerifyLimit(email)
  if (!limit.allowed) {
    return NextResponse.json(
      { erro: limit.message, success: false },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    )
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    // Anti-enumeration: mesmo erro de código inválido
    await new Promise((r) => setTimeout(r, 30 + Math.random() * 30))
    return NextResponse.json(
      { erro: GENERIC_INVALID, success: false },
      { status: 400 },
    )
  }

  // Busca o código mais recente VÁLIDO (não usado, não expirado, attempts < 5)
  const resetCode = await prisma.passwordResetCode.findFirst({
    where: {
      userId: user.id,
      usedAt: null,
      expiresAt: { gt: new Date() },
      attempts: { lt: MAX_CODE_ATTEMPTS_PER_CODE },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (!resetCode) {
    return NextResponse.json(
      { erro: GENERIC_INVALID, success: false },
      { status: 400 },
    )
  }

  // Compara hash
  const ok = await verifyCode(code, resetCode.code)

  if (!ok) {
    // Incrementa attempts. Se atingir limite, fica auto-invalidado pela
    // próxima query (attempts < 5 filter).
    const updated = await prisma.passwordResetCode.update({
      where: { id: resetCode.id },
      data: { attempts: { increment: 1 } },
    })

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
            action: 'PASSWORD_RESET_FAILED',
            entityType: 'User',
            entityId: user.id,
            metadata: JSON.stringify({
              attempts: updated.attempts,
              maxAttempts: MAX_CODE_ATTEMPTS_PER_CODE,
            }),
          },
        })
        .catch(() => null)
    }

    return NextResponse.json(
      {
        erro: GENERIC_INVALID,
        attemptsLeft: Math.max(0, MAX_CODE_ATTEMPTS_PER_CODE - updated.attempts),
        success: false,
      },
      { status: 400 },
    )
  }

  // Sucesso — emite token JWT scope=password-reset (15 min)
  // NÃO marca o código como "usedAt" aqui — só na troca efetiva da senha.
  const token = await signResetToken({ sub: user.id, email: user.email })

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
          action: 'PASSWORD_RESET_VERIFIED',
          entityType: 'User',
          entityId: user.id,
        },
      })
      .catch(() => null)
  }

  return NextResponse.json({ success: true, token })
}
