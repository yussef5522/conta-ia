// LUCRO POR SETOR — o DTO da tela (lei docs/lucro-por-setor-referencia.html v11). stock.view. SÓ LÊ.
// ⛔ A gravação de ficha NÃO mora aqui: a tela grava pela porta única do editor
//    (POST/PATCH /estoque/fichas) e recarrega este GET — a cascata é o servidor recalculando.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { lerTelaDoDia, diaDeHoje } from '@/lib/lucro-setor/tela'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  const agora = new Date()
  const dia = request.nextUrl.searchParams.get('dia') ?? diaDeHoje(agora)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return NextResponse.json({ erro: 'Dia inválido.' }, { status: 400 })
  try {
    return NextResponse.json(await lerTelaDoDia(companyId, dia, agora, prisma), { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    // ⛔ máscara: só o NOME do erro (a mensagem do Prisma pode carregar a URI do banco)
    console.error('[lucro-setor] leitura falhou:', (e as Error)?.name)
    return NextResponse.json({ erro: 'Não consegui montar o dia.' }, { status: 500 })
  }
}
