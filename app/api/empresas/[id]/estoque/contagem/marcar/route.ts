// ⭐⭐ "NÃO SEI / CONFERIR DEPOIS" e "PULAR" — estado de PRIMEIRA CLASSE (31/08/2026).
//
// ⚠️ Antes, deixar em branco era ambíguo: "não contei" e "contei e deu zero" eram a mesma
// coisa na tela. Agora é um fato registrado, com quem e quando — e a apurar > número
// inventado, a mesma régua do "sem contagem" da Posição e do "A DEFINIR" da etiqueta.
//
// ⚠️ NÃO MEXE NO LEDGER: linha sem número não vira ajuste. É `stock.operate` porque quem
// conta é quem sabe que não sabe.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireStock } from '@/lib/stock/require-stock'
import { marcarLinha, ContagemError } from '@/lib/stock/contagem'
import { respostaDeErroDoEstoque } from '@/lib/stock/erro-da-tela'

interface Params { params: Promise<{ id: string }> }

const schema = z.object({
  contagemId: z.string().min(1),
  itemId: z.string().min(1),
  estado: z.enum(['NAO_SEI', 'PULADO']),
  observacao: z.string().max(300).nullish(),
})

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const auth = await requireStock(request, companyId, 'stock.operate')
  if (!auth.ok) return auth.res
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Informe a contagem, o item e o estado.' }, { status: 400 })
  try {
    const r = await marcarLinha({ companyId, ...parsed.data, userId: auth.userId, userName: auth.userName }, prisma)
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
    const r = respostaDeErroDoEstoque(e, { empresaId: companyId })
    if (r) return NextResponse.json({ erro: r.erro, code: r.code, saida: r.saida }, { status: r.status })
    throw e
  }
}
