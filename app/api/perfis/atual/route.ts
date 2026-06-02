// Sprint PF FATIA 1 — Cookie httpOnly do perfil PF atual.
// Server Components leem pra saber qual perfil renderizar em páginas
// globais (igual o cookie `empresa_atual` faz pro PJ).

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { checkProfileAccess, ProfileAccessError } from '@/lib/personal-profile/queries'

const COOKIE_NAME = 'caixaos_perfil_atual'

const schema = z.object({
  profileId: z.string().min(1),
})

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  }
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ erro: 'JSON inválido' }, { status: 400 })
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ erro: 'profileId inválido' }, { status: 400 })
  }
  try {
    await checkProfileAccess(user.sub, parsed.data.profileId)
  } catch (err) {
    if (err instanceof ProfileAccessError) {
      return NextResponse.json({ erro: err.message, code: err.code }, { status: 404 })
    }
    throw err
  }
  const store = await cookies()
  store.set({
    name: COOKIE_NAME,
    value: parsed.data.profileId,
    httpOnly: true,
    secure: process.env.COOKIE_SECURE !== 'false',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 ano
  })
  return NextResponse.json({ ok: true })
}

export async function GET() {
  const store = await cookies()
  const v = store.get(COOKIE_NAME)?.value ?? null
  return NextResponse.json({ profileId: v })
}
