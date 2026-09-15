// ⭐⭐ O PLANO DA ETAPA — dia previsto próprio e "liberar pra equipe" (15/09/2026).
//
// ⛔ `stock.manage`: decidir QUANDO uma etapa acontece e QUEM pode pegá-la é gestão, não
// operação do dia — a mesma fronteira do designar. ⚠️ E a régua de recusa mora na LIB
// (`definirPlanoDaEtapa`), nunca aqui: a rota é casca fina.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { definirPlanoDaEtapa, PlanoEtapaError } from '@/lib/stock/producao/plano-etapas'

interface Params { params: Promise<{ id: string; etapaId: string }> }

const schema = z.object({
  // ⚠️ `null` explícito LIMPA (volta pro dia da ordem); ausente NÃO MEXE — mudar o dia não
  // pode desligar a liberação sem querer, nem o contrário.
  diaPrevisto: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  liberadaParaEquipe: z.boolean().optional(),
})

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId, etapaId } = await params
  const a = await guardStock(request, companyId, 'stock.manage')
  if (a.erro) return a.erro
  const p = schema.safeParse(await request.json().catch(() => null))
  if (!p.success) return NextResponse.json({ erro: 'Plano inválido.' }, { status: 400 })
  try {
    return NextResponse.json({ ok: true, plano: await definirPlanoDaEtapa({ companyId, etapaId, ...p.data, userId: a.user!.sub }, prisma) })
  } catch (e) {
    if (e instanceof PlanoEtapaError) return NextResponse.json({ erro: e.message }, { status: 422 })
    throw e
  }
}
