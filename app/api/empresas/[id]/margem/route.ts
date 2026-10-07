/**
 * ⭐⭐ A ROTA DA MARGEM (07/10/2026) — "quem paga a casa".
 *
 * ⛔ **Uma leitura só.** A tela inteira (linha de chegada, casa, liga, fora da obra, fila de
 * sabores) sai do MESMO `lerMargem`, com a MESMA janela — se cada bloco tivesse rota própria,
 * bastaria um recortar diferente pra a casa e a liga discordarem do mesmo período.
 *
 * ⚠️ `transaction.view` e não `stock.view`: a tela mostra **preço, margem e o custo fixo da
 * empresa** — é dinheiro, não operação de estoque. O operador que conta a câmara não vê isto
 * (a fronteira de papel de 24/08).
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { lerMargem } from '@/lib/margem/leitura'
import type { PeriodoDaMargem } from '@/lib/margem/janela'
import type { AbaDaLiga } from '@/lib/margem/liga'

interface Params {
  params: Promise<{ id: string }>
}

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/

const query = z.object({
  periodo: z.enum(['HOJE', 'SEMANA', 'MES', 'DATAS']).default('MES'),
  aba: z.enum(['CAIXA', 'MARGEM', 'VENDIDOS']).default('CAIXA'),
  de: z.string().regex(DATA_RE).optional(),
  ate: z.string().regex(DATA_RE).optional(),
})

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  try {
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.view')

    const sp = request.nextUrl.searchParams
    const q = query.parse({
      periodo: sp.get('periodo') ?? undefined,
      aba: sp.get('aba') ?? undefined,
      de: sp.get('de') ?? undefined,
      ate: sp.get('ate') ?? undefined,
    })

    const tela = await lerMargem(
      companyId,
      q.periodo as PeriodoDaMargem,
      new Date(),
      { de: q.de, ate: q.ate, aba: q.aba as AbaDaLiga, userId: ctx.user?.id },
    )
    return NextResponse.json(tela)
  } catch (e) {
    return handleApiError(e)
  }
}
