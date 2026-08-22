// ESTOQUE FASE 3 passo 2 — GET histórico "Processados" (um dia por linha).

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { listProcessados } from '@/lib/stock/vendas/baixa-venda'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Sessão expirada', code: 'AUTH_REQUIRED' }, { status: 401 })
  if (!(await prisma.userCompany.findFirst({ where: { userId: user.sub, companyId }, select: { companyId: true } }))) {
    return NextResponse.json({ erro: 'Empresa não encontrada' }, { status: 404 })
  }
  return NextResponse.json({ processados: await listProcessados(companyId, prisma) })
}
