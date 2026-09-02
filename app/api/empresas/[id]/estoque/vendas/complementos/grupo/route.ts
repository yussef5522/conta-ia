// Move um complemento entre SABORES e OUTROS.
//
// ⚠️ ROTA PRÓPRIA, e a permissão é LITERAL: o guard estrutural (`toda-rota-tem-trava`)
// audita as ~50 rotas de estoque estaticamente e recusa permissão em ternário. Agrupar é
// CONFIGURAÇÃO (muda como o dono enxerga o trabalho), então é `stock.manage` — a operadora
// vê, não move.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { moverGrupo, limparGrupo, GrupoComplementoError } from '@/lib/stock/vendas/grupo-complemento'

interface Params { params: Promise<{ id: string }> }

const schema = z.object({
  nomeSuitable: z.string().min(1).max(200),
  // ⭐ SEGUIR_CARDAPIO apaga o override — desfazer não pode exigir mexer no banco à mão
  // (a mesma regra do LIMPAR do mapa).
  grupo: z.enum(['SABOR', 'OUTRO', 'SEGUIR_CARDAPIO']),
})

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.manage')
  if (a.erro) return a.erro
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }, { status: 400 })
  const { nomeSuitable, grupo } = parsed.data
  try {
    if (grupo === 'SEGUIR_CARDAPIO') {
      await limparGrupo(companyId, nomeSuitable, prisma)
      return NextResponse.json({ ok: true, seguindoCardapio: true })
    }
    return NextResponse.json({ ok: true, ...(await moverGrupo(companyId, nomeSuitable, grupo, a.user!.sub, prisma)) })
  } catch (e) {
    if (e instanceof GrupoComplementoError) return NextResponse.json({ erro: e.message }, { status: 422 })
    throw e
  }
}
