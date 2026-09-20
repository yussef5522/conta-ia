// GET /api/conciliacao/fila — as três pilhas da Conciliação nova.
//
// ⛔ Substitui a dupla `/ofx-pendentes` + `/bulk-dry-run`, que juntas listavam
// "linha OFX sem categoria" — a fila de CLASSIFICAÇÃO com nome de conciliação.
// Aqui a pergunta é outra: **que vínculo está faltando?**

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { filaDeConciliacao } from '@/lib/conciliacao/fila-de-conciliacao'
import { divisaoDaTela } from '@/lib/conciliacao/divisao-da-tela'
import { prisma } from '@/lib/db'

const querySchema = z.object({ empresaId: z.string().cuid() })

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const data = querySchema.parse(Object.fromEntries(url.searchParams))

    const ctx = await getAuthContext(request, data.empresaId)
    ctx.requirePermission('transaction.view')

    /**
     * ⭐⭐⭐ A TERCEIRA SUPERFÍCIE (20/09) — era ESTA que desenhava o `[Vincular]` do
     * "pra tua mão" pro mesmo par que a caixa já mostrava com palpite.
     *
     * ⛔ A régua vem da porta ÚNICA, a mesma que `/caixa` e `/escolher-na-mao` chamam.
     */
    const { contasQueMoramNaCaixa } = await divisaoDaTela(data.empresaId, prisma)
    const fila = await filaDeConciliacao(data.empresaId, prisma, new Date(), contasQueMoramNaCaixa)
    return NextResponse.json(fila)
  } catch (error) {
    return handleApiError(error)
  }
}
