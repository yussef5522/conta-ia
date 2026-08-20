// ESTOQUE FASE 0 item 5 — GET /api/empresas/[id]/estoque/recebimentos
// Fila (AGUARDANDO_MERCADORIA) + históricas (contagem/período) + relatório. Só lê.

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { listRecebimentos } from '@/lib/stock/sefaz/recebimentos'
import { buildSefazReport } from '@/lib/stock/sefaz/report'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Sessão expirada', code: 'AUTH_REQUIRED' }, { status: 401 })
  const acesso = await prisma.userCompany.findFirst({ where: { userId: user.sub, companyId }, select: { companyId: true } })
  if (!acesso) return NextResponse.json({ erro: 'Empresa não encontrada' }, { status: 404 })

  const [recebimentos, relatorio] = await Promise.all([listRecebimentos(companyId), buildSefazReport(companyId)])
  return NextResponse.json({ recebimentos, relatorio })
}
