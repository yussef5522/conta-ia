// Sprint PF FATIA 1 — GET (lista) + POST (criar) perfis PF.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { listProfilesForUser, createProfile } from '@/lib/personal-profile/queries'

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  }
  const profiles = await listProfilesForUser(user.sub)
  return NextResponse.json({ profiles })
}

const createSchema = z.object({
  name: z.string().min(1).max(80),
  cpf: z.string().optional().nullable(),
  type: z.enum(['OWN', 'DEPENDENT']).optional(),
  birthDate: z.string().datetime().optional().nullable(),
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
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { erro: parsed.error.issues[0]?.message ?? 'Dados inválidos' },
      { status: 400 },
    )
  }
  const profile = await createProfile({
    userId: user.sub,
    name: parsed.data.name,
    cpf: parsed.data.cpf,
    type: parsed.data.type,
    birthDate: parsed.data.birthDate ? new Date(parsed.data.birthDate) : null,
  })
  return NextResponse.json({ profile }, { status: 201 })
}
