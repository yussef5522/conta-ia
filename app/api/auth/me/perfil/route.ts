// Sprint Gestão de Conta (31/05/2026) — PATCH perfil do usuário logado.
// Hoje só nome editável (email exige fluxo de verificação em sprint futura).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Nome muito curto')
    .max(120, 'Nome muito longo'),
})

export async function PATCH(request: NextRequest) {
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

  // ⚠️ Multi-tenant: SEMPRE atualiza pelo session.sub. Nunca aceita
  // userId do body — cliente não pode editar perfil de outro.
  const updated = await prisma.user.update({
    where: { id: sessionUser.sub },
    data: { name: parsed.data.name },
    select: { id: true, name: true, email: true },
  })

  return NextResponse.json({ success: true, usuario: updated })
}
