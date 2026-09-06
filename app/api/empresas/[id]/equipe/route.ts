// ⭐⭐ EQUIPE — a lista única (06/09/2026). Junta quem loga, quem usa PIN e quem foi
// convidado. ⚠️ Não é tabela nova: são as fontes que já existem, num lugar só.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext, AuthenticationError, ForbiddenError } from '@/lib/auth/rbac'
import { listarEquipe, resumoDaEquipe } from '@/lib/equipe/listar-equipe'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  try {
    const ctx = await getAuthContext(request, companyId)
    // ⚠️ `user.invite` é a chave de "mexer em gente" que já existia (a tela de Usuários usa
    // ela). Não invento chave nova: chave nova exige re-seed, e a lição de 24/08 é que
    // esquecer o re-seed dá 403 no próprio dono.
    ctx.requirePermission('user.invite')
  } catch (e) {
    if (e instanceof AuthenticationError) return NextResponse.json({ erro: 'Sessão expirada' }, { status: 401 })
    if (e instanceof ForbiddenError) return NextResponse.json({ erro: e.message, permission: e.permission }, { status: 403 })
    throw e
  }
  const pessoas = await listarEquipe(companyId, prisma, request.nextUrl.searchParams.get('inativos') === '1')
  return NextResponse.json({ pessoas, resumo: resumoDaEquipe(pessoas) })
}
