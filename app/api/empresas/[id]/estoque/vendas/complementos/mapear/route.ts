// Mapeia um complemento do PDV → FICHA de sabor | IGNORAR | (LIMPAR = volta a pendente).
//
// ⚠️ ROTA SEPARADA do import de propósito: mapear é CONFIGURAÇÃO (decide pra onde a venda
// baixa) e exige `stock.manage`; importar é operação do dia (`stock.operate`). A primeira
// versão juntava as duas com permissão em ternário e o guard `toda-rota-tem-trava`
// reprovou — ele exige a chave literal pra auditar as rotas sem executá-las.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { upsertComplementoMap, limparComplementoMap, ComplementoMapError } from '@/lib/stock/vendas/complemento-map'

interface Params { params: Promise<{ id: string }> }

const schema = z.object({
  nomeSuitable: z.string().min(1).max(200),
  // ⚠️ LIMPAR devolve ao estado PENDENTE — o IGNORAR é reversível por desenho (milkshake,
  // açaí e doces entram depois, e a volta não pode exigir mexer no banco à mão).
  destino: z.enum(['FICHA', 'IGNORAR', 'LIMPAR']),
  fichaId: z.string().nullable().optional(),
})

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.manage')
  if (a.erro) return a.erro
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Dados do mapeamento inválidos.' }, { status: 400 })
  const { nomeSuitable, destino, fichaId } = parsed.data
  try {
    if (destino === 'LIMPAR') {
      await limparComplementoMap(companyId, nomeSuitable, prisma)
      return NextResponse.json({ ok: true, destino: 'SEM_FICHA' })
    }
    if (destino === 'FICHA' && !fichaId) return NextResponse.json({ erro: 'Escolha a ficha do sabor.' }, { status: 400 })
    const r = await upsertComplementoMap(
      companyId, nomeSuitable,
      destino === 'FICHA' ? { tipo: 'FICHA', fichaId: fichaId! } : { tipo: 'IGNORAR' },
      a.user!.sub, prisma,
    )
    return NextResponse.json({ ok: true, ...r })
  } catch (e) {
    if (e instanceof ComplementoMapError) return NextResponse.json({ erro: e.message }, { status: 422 })
    throw e
  }
}
