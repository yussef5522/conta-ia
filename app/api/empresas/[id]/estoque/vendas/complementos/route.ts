// Import do Relatório de COMPLEMENTOS do PDV. Espelha a rota de produtos.
//
// ⚠️ O MAPEAMENTO MORA EM OUTRA ROTA (`complementos/mapear`), e não é organização: a
// primeira versão usava UMA rota com a permissão dinâmica
// (`ehMapa ? 'stock.manage' : 'stock.operate'`) — e o guard estrutural
// `toda-rota-tem-trava` REPROVOU, porque ele exige a chave LITERAL pra poder auditar as
// ~50 rotas de estoque estaticamente. O guard estava certo: permissão em ternário é
// permissão que ninguém consegue conferir sem executar.
//   importar = operação do dia    → stock.operate
//   mapear   = configuração (pra onde a venda baixa) → stock.manage
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { previewComplementos, confirmarComplementos, prateleiraGravada, ImportComplementoError } from '@/lib/stock/vendas/import-complementos'

interface Params { params: Promise<{ id: string }> }

const importSchema = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Escolha a data (AAAA-MM-DD).'),
  html: z.string().max(5_000_000),
  confirmar: z.boolean().optional(),
})

/** A prateleira, sem precisar de upload — abre do que já está gravado. */
export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  return NextResponse.json({ prateleira: await prateleiraGravada(companyId, prisma) })
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.operate')
  if (a.erro) return a.erro
  const parsed = importSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }, { status: 400 })
  const { data, html, confirmar } = parsed.data
  try {
    if (!confirmar) return NextResponse.json(await previewComplementos(companyId, data, html, prisma))
    return NextResponse.json(await confirmarComplementos(companyId, data, html, a.user!.sub, prisma))
  } catch (e) {
    if (e instanceof ImportComplementoError) return NextResponse.json({ erro: e.message }, { status: 422 })
    throw e
  }
}
