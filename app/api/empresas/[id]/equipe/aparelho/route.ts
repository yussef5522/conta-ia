// ⭐ MARCAR/DESMARCAR "conta de aparelho" (06/09/2026) — quem decide é o DONO.
//
// ⛔ Existe porque inferir isso do papel chamou uma PESSOA de máquina na lista (a Carlise, na
// prova contra os dados reais). Regra que ficou: *heurística nunca decide quem é máquina*.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext, AuthenticationError, ForbiddenError } from '@/lib/auth/rbac'

interface Params { params: Promise<{ id: string }> }
const schema = z.object({ vinculoId: z.string().min(1), ehAparelho: z.boolean() })

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  try {
    const ctx = await getAuthContext(request, companyId)
    // ⚠️ mesma chave da tela de Equipe: mexer em gente é `user.invite`. Não invento chave
    // nova — chave nova exige re-seed, e esquecer o re-seed dá 403 no próprio dono (24/08).
    ctx.requirePermission('user.invite')
  } catch (e) {
    if (e instanceof AuthenticationError) return NextResponse.json({ erro: 'Sessão expirada' }, { status: 401 })
    if (e instanceof ForbiddenError) return NextResponse.json({ erro: e.message }, { status: 403 })
    throw e
  }
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Dados inválidos.' }, { status: 400 })

  // ⛔ REGRA 8: o vínculo é resolvido DENTRO da empresa — um id vindo da tela nunca governa
  // sozinho de quem ele é.
  const vinculo = await prisma.userCompanyRole.findFirst({
    where: { id: parsed.data.vinculoId, companyId }, select: { id: true },
  })
  if (!vinculo) return NextResponse.json({ erro: 'Esse acesso não é desta empresa.' }, { status: 404 })

  await prisma.userCompanyRole.update({ where: { id: vinculo.id }, data: { ehAparelho: parsed.data.ehAparelho } })
  return NextResponse.json({ ok: true })
}
