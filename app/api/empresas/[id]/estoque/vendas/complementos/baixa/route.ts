// A BAIXA dos complementos: preview (GET) e executar (POST).
//
// ⚠️ Permissão LITERAL em cada handler — o guard estrutural (`toda-rota-tem-trava`) audita as
// ~50 rotas de estoque estaticamente e recusa ternário. GET é `stock.view`; baixar mexe no
// LEDGER e é operação do dia → `stock.operate`.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { montarPlanoComplementos, processarComplementos, listarDiasComplemento, BaixaComplementoError } from '@/lib/stock/vendas/baixa-complemento'

interface Params { params: Promise<{ id: string }> }

/** `?data=AAAA-MM-DD` → o preview daquele dia. Sem `data` → a lista de dias e o estado. */
export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  const data = new URL(request.url).searchParams.get('data')
  try {
    if (!data) return NextResponse.json({ dias: await listarDiasComplemento(companyId, prisma) })
    return NextResponse.json({ plano: await montarPlanoComplementos(companyId, data, prisma) })
  } catch (e) {
    if (e instanceof BaixaComplementoError) return NextResponse.json({ erro: e.message }, { status: 422 })
    throw e
  }
}

const schema = z.object({ data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Escolha o dia.') })

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.operate')
  if (a.erro) return a.erro
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }, { status: 400 })
  try {
    return NextResponse.json(await processarComplementos(companyId, parsed.data.data, a.user!.sub, prisma))
  } catch (e) {
    // ⛔ período recusado, dia sem ficha nenhuma: 422 com a mensagem que ENSINA a saída
    if (e instanceof BaixaComplementoError) return NextResponse.json({ erro: e.message }, { status: 422 })
    throw e
  }
}
