// ESTOQUE FASE 3 PARTE 2 — POST finaliza (ou cancela) a sessão aberta.
// "Salvar e sair" NÃO passa por aqui: a linha já foi gravada quando foi contada, então
// sair da tela é só sair — a sessão continua ABERTA e o dono retoma depois.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireStock } from '@/lib/stock/require-stock'
import { finalizarContagem, cancelarContagem, ContagemError } from '@/lib/stock/contagem'
import { respostaDeErroDoEstoque } from '@/lib/stock/erro-da-tela'

interface Params { params: Promise<{ id: string }> }

const schema = z.object({
  contagemId: z.string().min(1),
  acao: z.enum(['finalizar', 'cancelar']).default('finalizar'),
})

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const auth = await requireStock(request, companyId, 'stock.operate')
  if (!auth.ok) return auth.res
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Informe a contagem.' }, { status: 400 })
  try {
    const c = parsed.data.acao === 'cancelar'
      ? await cancelarContagem(companyId, parsed.data.contagemId, prisma)
      : await finalizarContagem(companyId, parsed.data.contagemId, prisma)
    return NextResponse.json({ ok: true, contagem: { id: c.id, status: c.status } })
  } catch (e) {
    /**
     * ⭐⭐ RECUSA ENSINA A SAÍDA (16/09) — o tradutor único do estoque.
     * ⛔ Antes daqui existia um `throw e` que virava **500 sem corpo**, e o cliente caía
     * no fallback genérico. Foi assim que a contagem do fermento disse *"não consegui
     * gravar"* enquanto o servidor tinha a explicação inteira na mão.
     * ⚠️ Erro que ninguém previu CONTINUA re-lançado: inventar frase amigável pra bug
     * desconhecido esconde o bug.
     */
    const r = respostaDeErroDoEstoque(e, { empresaId: companyId })
    if (r) return NextResponse.json({ erro: r.erro, code: r.code, saida: r.saida }, { status: r.status })
    throw e
  }
}
