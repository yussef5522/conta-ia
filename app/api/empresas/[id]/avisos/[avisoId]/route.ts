import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, AuthenticationError } from '@/lib/auth/rbac'
import { marcarLido } from '@/lib/avisos/central'
import { setoresVisiveis } from '@/lib/avisos/visibilidade'
import { prisma } from '@/lib/db'

/**
 * ⭐ MARCAR UM AVISO COMO LIDO.
 *
 * ⚠️ A trava confere o SETOR do aviso contra a permissão: sem isso, quem só opera estoque
 * poderia marcar como lido (e portanto SILENCIAR) um aviso de financeiro que ele nem pode ver.
 * É a mesma fronteira de 30/08 — e aqui o estrago seria apagar da frente do dono um alarme de
 * dinheiro.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; avisoId: string }> },
) {
  const { id: companyId, avisoId } = await params
  try {
    const ctx = await getAuthContext(request, companyId)
    if (!ctx.company) return NextResponse.json({ erro: 'Empresa não encontrada' }, { status: 404 })

    const aviso = await prisma.aviso.findFirst({
      where: { id: avisoId, companyId },
      select: { setor: true },
    })
    if (!aviso) return NextResponse.json({ erro: 'Aviso não encontrado' }, { status: 404 })

    const permitidos = setoresVisiveis(ctx.permissions)
    if (!permitidos.includes(aviso.setor as (typeof permitidos)[number])) {
      return NextResponse.json({ erro: 'Sem permissão pra este aviso' }, { status: 403 })
    }

    const mudou = await marcarLido(companyId, avisoId)
    return NextResponse.json({ ok: true, mudou })
  } catch (e) {
    if (e instanceof AuthenticationError) {
      return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
    }
    console.error('[avisos] falha ao marcar lido:', e)
    return NextResponse.json({ erro: 'Não consegui marcar como lido.' }, { status: 500 })
  }
}
