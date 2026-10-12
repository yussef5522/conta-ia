/**
 * ⭐ A ESTRELA DO DONO — liga/desliga a receita PRINCIPAL (12/10/2026).
 *
 * ⛔ **Casca fina sobre a porta única** (`marcarReceitaPrincipal`): a rota valida a forma,
 * exige a sessão do painel e delega. Ela **não escreve** em `stock_receita_principal` por
 * conta própria — segundo caminho de escrita faria a coluna significar duas coisas.
 *
 * ⚠️ **`stock.manage`, não `operate`:** decidir o que é importante na lista de receitas é
 * organizar a casa do dono, a mesma fronteira do mín/máx, da ficha e do mapa do PDV. Quem
 * opera (a cozinha) produz e separa; não escolhe o que fica fixado no topo.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { guardStock } from '@/lib/stock/require-stock'
import { marcarReceitaPrincipal, ReceitaPrincipalError } from '@/lib/stock/producao/receita-principal'
import { respostaDeErroDoEstoque } from '@/lib/stock/erro-da-tela'

interface Params { params: Promise<{ id: string; fichaId: string }> }

/**
 * ⚠️ `.strict()` de propósito: campo a mais no corpo é **400**, nunca recortado em silêncio —
 * a cicatriz de 25/09, em que o zod aparou um campo e dois gestos ficaram mortos por dias.
 */
const bodySchema = z.object({ principal: z.boolean() }).strict()

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId, fichaId } = await params
  const a = await guardStock(request, companyId, 'stock.manage')
  if (a.erro) return a.erro

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ erro: 'Diga se a receita é principal (true) ou não (false).' }, { status: 400 })
  }

  try {
    const r = await marcarReceitaPrincipal(
      { companyId, fichaId, principal: parsed.data.principal, userId: a.user?.sub ?? null },
      undefined,
    )
    return NextResponse.json(r)
  } catch (e) {
    if (e instanceof ReceitaPrincipalError) return NextResponse.json({ erro: e.message }, { status: 404 })
    return respostaDeErroDoEstoque(e)
  }
}
