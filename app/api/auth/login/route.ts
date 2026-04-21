import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { ZodError } from 'zod'
import { prisma } from '@/lib/db'
import { signToken, COOKIE_NAME, COOKIE_OPTIONS } from '@/lib/auth'
import { loginSchema } from '@/lib/validations/auth'
import { rateLimit, rateLimitKey } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  // 10 tentativas por minuto por IP
  const { allowed, retryAfterMs } = rateLimit(rateLimitKey(request, 'login'), 10, 60_000)
  if (!allowed) {
    return NextResponse.json(
      { erro: 'Muitas tentativas de login. Aguarde 1 minuto.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
    )
  }

  try {
    const body = await request.json()
    const data = loginSchema.parse(body)

    const user = await prisma.user.findUnique({ where: { email: data.email } })

    // Tempo constante para evitar enumeração de usuários
    const senhaValida = user ? await bcrypt.compare(data.password, user.password) : false

    if (!user || !senhaValida) {
      return NextResponse.json({ erro: 'E-mail ou senha inválidos' }, { status: 401 })
    }

    const token = await signToken({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    })

    const response = NextResponse.json({
      usuario: { id: user.id, email: user.email, name: user.name, role: user.role },
    })

    response.cookies.set(COOKIE_NAME, token, COOKIE_OPTIONS)

    return response
  } catch (error) {
    if (error instanceof ZodError) {
      const campos: Record<string, string> = {}
      error.errors.forEach((e) => {
        if (e.path[0]) campos[e.path[0] as string] = e.message
      })
      return NextResponse.json({ erro: 'Dados inválidos', campos }, { status: 400 })
    }
    console.error('[LOGIN] Erro interno:', error)
    return NextResponse.json({ erro: 'Erro interno do servidor' }, { status: 500 })
  }
}
