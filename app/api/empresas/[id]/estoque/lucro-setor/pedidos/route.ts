// LUCRO POR SETOR — "ver pedidos →" (S19): os pedidos REAIS do laço que formaram o número de um item.
// ⛔ V8: nº, hora, qtd e sabores — dado de cliente NÃO EXISTE nesta resposta (allowlist em lib/lucro-setor/tela.ts).
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { pedidosDoItem } from '@/lib/lucro-setor/tela'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  const dia = request.nextUrl.searchParams.get('dia') ?? ''
  const chave = request.nextUrl.searchParams.get('chave') ?? ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia) || !chave || chave.length > 300) return NextResponse.json({ erro: 'Dados inválidos.' }, { status: 400 })
  try {
    return NextResponse.json({ pedidos: await pedidosDoItem(companyId, dia, chave, prisma) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('[lucro-setor/pedidos] leitura falhou:', (e as Error)?.name)
    return NextResponse.json({ erro: 'Não consegui listar os pedidos.' }, { status: 500 })
  }
}
