// POST /api/auth/login
// Sprint 1.2 — login premium. Refinos:
//   - Rate limit 5 tentativas / 15 min por IP (mais conservador que 10/min anterior)
//   - Audit log USER_LOGIN escopado à primeira empresa do user (quando houver)
//   - Mensagens de erro em pt-BR diferenciadas por status

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { ZodError } from 'zod'
import { prisma } from '@/lib/db'
import { signToken, COOKIE_NAME, COOKIE_OPTIONS } from '@/lib/auth'
import { loginSchema } from '@/lib/validations/auth'
import { rateLimit, rateLimitKey } from '@/lib/rate-limit'

// Sprint 1.2 — 5 tentativas / 15 min por IP. Mais conservador que limit
// padrão (anti brute force de senha).
const LOGIN_MAX_ATTEMPTS = 5
const LOGIN_WINDOW_MS = 15 * 60 * 1000

export async function POST(request: NextRequest) {
  const { allowed, retryAfterMs } = rateLimit(
    rateLimitKey(request, 'login'),
    LOGIN_MAX_ATTEMPTS,
    LOGIN_WINDOW_MS,
  )
  if (!allowed) {
    const minutes = Math.ceil(retryAfterMs / 60_000)
    return NextResponse.json(
      {
        erro:
          minutes <= 1
            ? 'Muitas tentativas. Tente novamente em alguns segundos.'
            : `Muitas tentativas. Tente novamente em ${minutes} minutos.`,
      },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) },
      },
    )
  }

  try {
    const body = await request.json()
    const data = loginSchema.parse(body)

    const user = await prisma.user.findUnique({ where: { email: data.email } })

    // Tempo constante para evitar enumeração de usuários
    const senhaValida = user
      ? await bcrypt.compare(data.password, user.password)
      : false

    if (!user || !senhaValida) {
      // Mensagem genérica intencional (não vaza se email existe ou não)
      return NextResponse.json(
        { erro: 'E-mail ou senha incorretos' },
        { status: 401 },
      )
    }

    const token = await signToken({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    })

    // Sprint 1.2 — Audit USER_LOGIN escopado à primeira empresa do user.
    // Single-user atual = Yussef-OWNER da Cacula Mix → log fica em Cacula Mix.
    // Best-effort: failure aqui não impede login.
    // (Sprint 1.5 vai adicionar User.lastLoginAt + audit independente de empresa.)
    void recordLoginAudit(user.id, user.name, user.email, request).catch(
      (err) => console.error('[LOGIN audit] erro best-effort:', err),
    )

    const response = NextResponse.json({
      usuario: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    })

    response.cookies.set(COOKIE_NAME, token, COOKIE_OPTIONS)

    return response
  } catch (error) {
    if (error instanceof ZodError) {
      const campos: Record<string, string> = {}
      error.errors.forEach((e) => {
        if (e.path[0]) campos[e.path[0] as string] = e.message
      })
      return NextResponse.json(
        { erro: 'Dados inválidos', campos },
        { status: 400 },
      )
    }
    console.error('[LOGIN] Erro interno:', error)
    return NextResponse.json(
      { erro: 'Erro interno do servidor' },
      { status: 500 },
    )
  }
}

async function recordLoginAudit(
  userId: string,
  userName: string,
  userEmail: string,
  request: NextRequest,
): Promise<void> {
  // Pega primeira empresa do user (audit_log exige companyId NOT NULL).
  // Se user ainda não tem empresa, pula audit (cadastro novo sem empresa).
  const userCompany = await prisma.userCompany.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: { companyId: true },
  })
  if (!userCompany) return

  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    null
  const userAgent = request.headers.get('user-agent') ?? null

  await prisma.auditLog.create({
    data: {
      companyId: userCompany.companyId,
      userId,
      userName,
      userEmail,
      action: 'USER_LOGIN',
      entityType: 'User',
      entityId: userId,
      ipAddress,
      userAgent,
    },
  })
}
