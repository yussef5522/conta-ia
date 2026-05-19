// POST /api/admin/login
// Sprint 1.6 — login do painel Gerenciador.
//
// Segurança:
//   - Anti-enumeration: mensagem genérica "Credenciais inválidas" pros 3 casos
//     (email inexistente, gerenciador inativo, senha errada).
//   - Rate limit: 5 tentativas / 15 min POR IP (anti-brute force).
//   - Host check: REJEITA se acessado via app.caixaos.com.br (defesa em profundidade).
//   - Audit: ADMIN_LOGIN, ADMIN_LOGIN_FAILED, ADMIN_LOGIN_RATE_LIMITED.
//   - Cookie admin_session com Domain=admin.caixaos.com.br (não vaza pro app).

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import {
  ADMIN_COOKIE_NAME,
  getAdminCookieOptions,
  signAdminToken,
} from '@/lib/admin-auth/jwt'
import { checkAdminLoginRateLimit } from '@/lib/admin-auth/rate-limit'
import { isAdminHost } from '@/lib/middleware/subdomain'

const schema = z.object({
  email: z.string().email('Email inválido').toLowerCase(),
  password: z.string().min(1, 'Senha obrigatória'),
})

const GENERIC_INVALID = 'Credenciais inválidas'

async function logAuditFailure(
  action: 'ADMIN_LOGIN_FAILED' | 'ADMIN_LOGIN_RATE_LIMITED',
  gerenciadorId: string | null,
  request: NextRequest,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  // ADMIN_LOGIN_FAILED com gerenciadorId conhecido (senha errada)
  // ADMIN_LOGIN_RATE_LIMITED ou email inexistente: sem gerenciadorId — pula audit
  // (Audit log exige FK pra Gerenciador).
  if (!gerenciadorId) return
  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    null
  const userAgent = request.headers.get('user-agent') ?? null
  await prisma.gerenciadorAuditLog
    .create({
      data: {
        gerenciadorId,
        action,
        ipAddress,
        userAgent,
        metadata: Object.keys(metadata).length
          ? JSON.stringify(metadata)
          : null,
      },
    })
    .catch((e) =>
      console.error('[admin login audit fail]', e instanceof Error ? e.message : e),
    )
}

export async function POST(request: NextRequest) {
  // 0. Host check defensivo — endpoint só responde via admin.*
  const host = request.headers.get('host')
  if (!isAdminHost(host)) {
    return new NextResponse('Not Found', { status: 404 })
  }

  // 1. Rate limit por IP (5/15min)
  const rl = checkAdminLoginRateLimit(request)
  if (!rl.allowed) {
    return NextResponse.json(
      {
        erro: `Muitas tentativas. Tente novamente em ${rl.retryAfterMinutes} minuto${rl.retryAfterMinutes === 1 ? '' : 's'}.`,
        success: false,
      },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) },
      },
    )
  }

  // 2. Parse body
  let email: string
  let password: string
  try {
    const body = await request.json()
    const data = schema.parse(body)
    email = data.email
    password = data.password
  } catch {
    return NextResponse.json(
      { erro: 'Dados inválidos', success: false },
      { status: 400 },
    )
  }

  // 3. Busca gerenciador + valida senha em tempo constante
  const gerenciador = await prisma.gerenciador.findUnique({
    where: { email },
  })
  const senhaValida = gerenciador
    ? await bcrypt.compare(password, gerenciador.passwordHash)
    : false

  // 4. Falhas (todas com mesma mensagem — anti-enumeration)
  if (!gerenciador || !senhaValida || !gerenciador.active) {
    if (gerenciador) {
      // Audit só quando há gerenciador real (FK obrigatória)
      await logAuditFailure('ADMIN_LOGIN_FAILED', gerenciador.id, request, {
        senhaInvalida: !senhaValida,
        inativo: !gerenciador.active,
      })
    }
    return NextResponse.json(
      { erro: GENERIC_INVALID, success: false },
      { status: 401 },
    )
  }

  // 5. Sucesso — emite JWT + grava lastLoginAt
  await prisma.gerenciador.update({
    where: { id: gerenciador.id },
    data: { lastLoginAt: new Date() },
  })

  const token = await signAdminToken({
    sub: gerenciador.id,
    email: gerenciador.email,
    name: gerenciador.name,
    role: gerenciador.role,
  })

  // 6. Audit ADMIN_LOGIN
  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    null
  const userAgent = request.headers.get('user-agent') ?? null
  await prisma.gerenciadorAuditLog
    .create({
      data: {
        gerenciadorId: gerenciador.id,
        action: 'ADMIN_LOGIN',
        ipAddress,
        userAgent,
      },
    })
    .catch((e) =>
      console.error('[admin login audit ok]', e instanceof Error ? e.message : e),
    )

  // 7. Set cookie + retorna payload (sem senha)
  const response = NextResponse.json({
    success: true,
    gerenciador: {
      id: gerenciador.id,
      email: gerenciador.email,
      name: gerenciador.name,
      role: gerenciador.role,
    },
  })

  response.cookies.set(ADMIN_COOKIE_NAME, token, getAdminCookieOptions())

  return response
}
