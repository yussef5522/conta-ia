// ESTOQUE FASE 3 PARTE 2 — POST conta UMA linha (grava o AJUSTE_CONTAGEM na hora).
// O FREIO mora aqui: divergência grande sem `confirmarFreio` volta 409 code=FREIO e o
// ledger NÃO se move. A 2ª confirmação é do SERVIDOR, não da tela (REGRA 5).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireStock } from '@/lib/stock/require-stock'
import { contarLinha, ContagemError } from '@/lib/stock/contagem'
import { respostaDeErroDoEstoque } from '@/lib/stock/erro-da-tela'

interface Params { params: Promise<{ id: string }> }

const schema = z.object({
  contagemId: z.string().min(1),
  itemId: z.string().min(1),
  qtdContada: z.number().min(0),
  confirmarFreio: z.boolean().optional(),
  // ⭐ CONTAGEM CEGA: ela apertou "ver o que o sistema diz"? Não é proibição, é rastro.
  viuSistema: z.boolean().optional(),
  // ⭐ observação de QUEM VIU ("estava molhado") — não é decisão, é o que faz o dono
  // investigar certo depois. Por isso a operadora pode escrever (é `stock.operate`).
  observacao: z.string().max(300).nullish(),
})

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const auth = await requireStock(request, companyId, 'stock.operate')
  if (!auth.ok) return auth.res
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Informe a contagem, o item e a quantidade contada.' }, { status: 400 })
  try {
    const r = await contarLinha({ companyId, ...parsed.data, userId: auth.userId, userName: auth.userName }, prisma)
    return NextResponse.json(r)
  } catch (e) {
    /**
     * ⭐⭐ RECUSA ENSINA A SAÍDA (16/09) — o tradutor único do estoque.
     * ⛔ Antes daqui existia um `throw e` que virava **500 sem corpo**, e o cliente caía
     * no fallback genérico. Foi assim que a contagem do fermento disse *"não consegui
     * gravar"* enquanto o servidor tinha a explicação inteira na mão.
     * ⚠️ Erro que ninguém previu CONTINUA re-lançado: inventar frase amigável pra bug
     * desconhecido esconde o bug.
     */
    const r = respostaDeErroDoEstoque(e, { empresaId: companyId, itemId: parsed.data.itemId })
    if (r) return NextResponse.json({ erro: r.erro, code: r.code, saida: r.saida }, { status: r.status })
    throw e
  }
}
