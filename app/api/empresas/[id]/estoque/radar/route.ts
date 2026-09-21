// ⭐⭐ RADAR DO ESTOQUE — GET (20/09/2026). Nasce com `requireStock` (stock.view: é
// relatório, não mexe em nada) e com os estados que a tela precisa pra nunca girar pra
// sempre — a rota ou devolve o fechamento, ou devolve um erro COM FRASE.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireStock } from '@/lib/stock/require-stock'
import { calcularFechamentoDoDia } from '@/lib/stock/radar/fechamento'
import { listasDoRadar } from '@/lib/stock/radar/watchlist'
import { janelaDoPeriodo, type ChavePeriodo } from '@/lib/stock/radar/periodo'
import { respostaDeErroDoEstoque } from '@/lib/stock/erro-da-tela'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const auth = await requireStock(request, companyId, 'stock.view')
  if (!auth.ok) return auth.res

  try {
    const sp = request.nextUrl.searchParams
    // ⭐ a janela sai de uma FUNÇÃO PURA, não de um if na rota: a tela mostra o rótulo do
    // mesmo lugar de onde a consulta tira as datas, então os dois não têm como divergir.
    const janela = janelaDoPeriodo(
      (sp.get('periodo') ?? 'ONTEM_HOJE') as ChavePeriodo,
      { de: sp.get('de'), ate: sp.get('ate') },
    )
    const listas = await listasDoRadar(companyId, prisma, auth.userId)
    const radar = await calcularFechamentoDoDia(
      { companyId, de: janela.de, ate: janela.ate, caros: listas.caros, revenda: listas.revenda, porcoes: listas.porcoes },
      prisma,
    )
    return NextResponse.json({ ...radar, janela, listaSemeadaAgora: listas.semeadaAgora })
  } catch (e) {
    // ⭐ o tradutor único do módulo: erro de domínio vira 422 que ENSINA; o que ninguém
    // previu continua 500 — ali o genérico é honesto (a régua de 16/09).
    const r = respostaDeErroDoEstoque(e, { empresaId: companyId })
    if (r) return NextResponse.json({ erro: r.erro, code: r.code, saida: r.saida }, { status: r.status })
    throw e
  }
}
