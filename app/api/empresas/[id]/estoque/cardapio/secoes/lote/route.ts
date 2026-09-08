// ⭐⭐ O LOTE DE CLASSIFICAÇÃO — o gesto que evita 156 cliques.
//
// GET  = o preview (os produtos agrupados pela sugestão, com o motivo de cada um)
// POST = o confirmar único
//
// ⛔ O GET não grava nada: a sugestão que ele mostra é calculada na hora. Ler não escreve —
// senão abrir a tela já teria classificado o cardápio inteiro sem o dono ver.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { handleApiError } from '@/lib/api/handle-error'
import { guardStock } from '@/lib/stock/require-stock'
import { hubCardapio } from '@/lib/stock/cardapio/hub'
import { montarLote } from '@/lib/stock/cardapio/secoes'
import { secoesDaEmpresa, secoesPorNome, confirmarLote } from '@/lib/stock/cardapio/secoes-db'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: companyId } = await params
    const a = await guardStock(request, companyId, 'stock.view')
    if (a.erro) return a.erro

    const [hub, secoes, gravadas] = await Promise.all([
      hubCardapio(companyId), secoesDaEmpresa(companyId), secoesPorNome(companyId),
    ])
    // ⛔ "já confirmado" é quem tem ALGUM nome com `sugerida: false` — a decisão do dono
    const confirmados = new Set(hub.linhas
      .filter((l) => l.nomesSuitable.some((n) => gravadas.get(n)?.sugerida === false))
      .map((l) => l.chave))

    const lote = montarLote(
      hub.linhas.map((l) => ({
        chave: l.chave, nome: l.nome, nomesSuitable: l.nomesSuitable, vendasQtd: l.vendasQtd,
      })),
      confirmados,
    )
    return NextResponse.json({ lote, secoes, jaConfirmados: confirmados.size })
  } catch (error) { return handleApiError(error) }
}

const corpo = z.object({
  itens: z.array(z.object({
    nomesSuitable: z.array(z.string().min(1)).min(1).max(50),
    secao: z.string().min(1).max(40),
  })).min(1).max(500),
})

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: companyId } = await params
    const a = await guardStock(request, companyId, 'stock.manage')
    if (a.erro) return a.erro
    const d = corpo.parse(await request.json())
    const r = await confirmarLote(companyId, d.itens, a.user?.sub)
    return NextResponse.json({ ok: true, ...r })
  } catch (error) { return handleApiError(error) }
}
