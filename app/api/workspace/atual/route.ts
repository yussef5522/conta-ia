// Bug 2 fix — Cookie httpOnly do workspace TYPE atual (pj|pf).
// Server Components leem pra decidir se devem redirecionar pro contexto
// correto. Sem este cookie, Dashboard PJ renderiza mesmo com user em PF
// (Bug 2 reportado por Yussef: switcher diz PF, conteúdo é Cacula).

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'

const COOKIE_NAME = 'caixaos_workspace_type'

const schema = z.object({
  type: z.enum(['pj', 'pf']),
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
    return NextResponse.json({ erro: 'type inválido' }, { status: 400 })
  }

  const store = await cookies()
  store.set({
    name: COOKIE_NAME,
    value: parsed.data.type,
    httpOnly: true,
    secure: process.env.COOKIE_SECURE !== 'false',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })
  return NextResponse.json({ ok: true })
}

export async function GET() {
  const store = await cookies()
  const v = store.get(COOKIE_NAME)?.value
  return NextResponse.json({ type: v === 'pf' ? 'pf' : 'pj' })
}
