import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { ZodError } from 'zod'
import { prisma } from '@/lib/db'
import { signToken, COOKIE_NAME, COOKIE_OPTIONS } from '@/lib/auth'
import { cadastroSchema } from '@/lib/validations/auth'
import { rateLimit, rateLimitKey } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  // 5 cadastros por hora por IP
  const { allowed, retryAfterMs } = rateLimit(rateLimitKey(request, 'cadastro'), 5, 60 * 60_000)
  if (!allowed) {
    return NextResponse.json(
      { erro: 'Muitos cadastros deste IP. Aguarde antes de tentar novamente.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
    )
  }

  try {
    const body = await request.json()
    const data = cadastroSchema.parse(body)

    const existente = await prisma.user.findUnique({ where: { email: data.email } })
    if (existente) {
      return NextResponse.json(
        { erro: 'Este e-mail já está em uso', campos: { email: 'Este e-mail já está em uso' } },
        { status: 409 }
      )
    }

    // bcrypt rounds >= 12 conforme requisito de segurança
    const senhaHash = await bcrypt.hash(data.password, 12)

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: senhaHash,
        role: 'CLIENT',
      },
    })

    const token = await signToken({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    })

    const response = NextResponse.json(
      { usuario: { id: user.id, email: user.email, name: user.name, role: user.role } },
      { status: 201 }
    )

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
    console.error('[CADASTRO] Erro interno:', error)
    return NextResponse.json({ erro: 'Erro interno do servidor' }, { status: 500 })
  }
}
