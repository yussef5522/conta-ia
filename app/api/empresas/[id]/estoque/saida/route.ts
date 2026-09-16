// ESTOQUE PARTE C — POST registrar saída (perda/uso interno). Motivo obrigatório.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { registrarSaida, SaidaError, MOTIVOS } from '@/lib/stock/saida'
import { respostaDeErroDoEstoque } from '@/lib/stock/erro-da-tela'

interface Params { params: Promise<{ id: string }> }

const schema = z.object({
  itemId: z.string().min(1),
  quantidade: z.number().positive(),
  motivo: z.enum(Object.keys(MOTIVOS) as [string, ...string[]]),
  motivoTexto: z.string().max(300).nullable().optional(),
  fotoBase64: z.string().max(2_000_000).nullable().optional(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.operate')
  if (a.erro) return a.erro
  const user = a.user
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Informe item, quantidade e motivo.' }, { status: 400 })
  try {
    const r = await registrarSaida({ companyId, userId: user.sub, ...parsed.data, motivo: parsed.data.motivo as keyof typeof MOTIVOS }, prisma)
    return NextResponse.json({ ok: true, ...r })
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
