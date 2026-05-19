// POST /api/auth/forgot-password
// Sprint 1.5 — solicita código de redefinição via email.
//
// Anti-enumeration: SEMPRE retorna 200 mesmo se email não existe.
// Rate limit: 3 solicitações / 15 min + 1 reenvio / 60s por email.
// Audit: PASSWORD_RESET_REQUESTED (apenas quando user existe).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import {
  generateResetCode,
  codeHint,
  hashCode,
  CODE_EXPIRES_MIN,
} from '@/lib/auth/password-reset'
import {
  checkRequestLimit,
  checkResendLimit,
} from '@/lib/security/forgot-password-rate-limit'
import { sendEmail, maskEmail } from '@/lib/email/send'
import { renderForgotPasswordHtml } from '@/lib/email/render'

const schema = z.object({
  email: z.string().email('Email inválido').toLowerCase(),
})

// Resposta genérica usada nos 3 casos (sucesso, user inexistente, erro Resend).
// Mantém anti-enumeration: caller NUNCA sabe se o email existe.
function genericSuccess(email: string) {
  return NextResponse.json({
    success: true,
    message:
      'Se este email estiver cadastrado, você receberá um código de 6 dígitos em instantes.',
    maskedEmail: maskEmail(email),
  })
}

export async function POST(request: NextRequest) {
  let email: string
  try {
    const body = await request.json()
    const data = schema.parse(body)
    email = data.email
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { erro: 'Email inválido', success: false },
        { status: 400 },
      )
    }
    return NextResponse.json(
      { erro: 'Requisição inválida', success: false },
      { status: 400 },
    )
  }

  // Rate limit 1: max 3 solicitações/15min
  const reqLimit = checkRequestLimit(email)
  if (!reqLimit.allowed) {
    return NextResponse.json(
      { erro: reqLimit.message, retryAfterSeconds: reqLimit.retryAfterSeconds, success: false },
      {
        status: 429,
        headers: { 'Retry-After': String(reqLimit.retryAfterSeconds) },
      },
    )
  }

  // Rate limit 2: 1 reenvio/60s
  const resendLimit = checkResendLimit(email)
  if (!resendLimit.allowed) {
    return NextResponse.json(
      { erro: resendLimit.message, retryAfterSeconds: resendLimit.retryAfterSeconds, success: false },
      {
        status: 429,
        headers: { 'Retry-After': String(resendLimit.retryAfterSeconds) },
      },
    )
  }

  // Anti-enumeration: NÃO revela se o user existe
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    // Pequeno delay simulado pra timing-attacks (não perfeito, mas dificulta)
    await new Promise((r) => setTimeout(r, 50 + Math.random() * 50))
    return genericSuccess(email)
  }

  // Gera código + hash
  const code = generateResetCode()
  const codeHash = await hashCode(code)
  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    null
  const userAgent = request.headers.get('user-agent') ?? null

  await prisma.passwordResetCode.create({
    data: {
      userId: user.id,
      code: codeHash,
      codeHint: codeHint(code),
      expiresAt: new Date(Date.now() + CODE_EXPIRES_MIN * 60_000),
      ipAddress,
      userAgent,
    },
  })

  // Audit (escopado à primeira empresa do user — audit_log exige companyId)
  const userCompany = await prisma.userCompany.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
    select: { companyId: true },
  })
  if (userCompany) {
    await prisma.auditLog
      .create({
        data: {
          companyId: userCompany.companyId,
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          action: 'PASSWORD_RESET_REQUESTED',
          entityType: 'User',
          entityId: user.id,
          ipAddress,
          userAgent,
        },
      })
      .catch((e) => console.error('[audit PASSWORD_RESET_REQUESTED]', e))
  }

  // Envia email — best-effort (não bloqueia anti-enumeration mesmo se falhar)
  const html = await renderForgotPasswordHtml({
    userName: user.name,
    code,
    expiresInMinutes: CODE_EXPIRES_MIN,
    ipAddress,
  })

  const result = await sendEmail({
    to: user.email,
    subject: `Seu código de redefinição: ${code}`,
    html,
    type: 'forgot-password',
    userId: user.id,
  })

  if (!result.success && !result.skipped) {
    console.error('[forgot-password] envio falhou:', result.error)
    // Continue retornando sucesso (anti-enumeration)
  }

  return genericSuccess(email)
}
