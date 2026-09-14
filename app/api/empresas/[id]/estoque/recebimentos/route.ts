// ESTOQUE FASE 0 item 5 — GET /api/empresas/[id]/estoque/recebimentos
// Fila (AGUARDANDO_MERCADORIA) + históricas (contagem/período) + relatório. Só lê.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { listRecebimentos } from '@/lib/stock/sefaz/recebimentos'
import { buildSefazReport } from '@/lib/stock/sefaz/report'
import { mesCorrente } from '@/lib/periodo/mes-corrente'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro

  /**
   * ⭐ O MÊS DAS **RECEBIDAS** (14/09) — padrão: o corrente, nunca "desde sempre".
   * ⛔ A FILA ignora: trabalho pendente não expira com a virada do mês.
   */
  const mes = new URL(request.url).searchParams.get('mes') ?? mesCorrente()
  const [recebimentos, relatorio] = await Promise.all([
    listRecebimentos(companyId, prisma, new Date(), mes),
    buildSefazReport(companyId),
  ])
  return NextResponse.json({ recebimentos, relatorio, mes })
}
