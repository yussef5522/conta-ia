// ESTOQUE FASE 1 item 2 — GET preview da conferência (MODO TESTE, não grava nada).
// Devolve a nota ilustrativa (golden) + os itens de estoque já existentes (pra o
// dono testar a busca ao mapear). Nenhuma escrita.

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { buildPreviewConference } from '@/lib/stock/conference-preview'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Sessão expirada', code: 'AUTH_REQUIRED' }, { status: 401 })
  if (!(await prisma.userCompany.findFirst({ where: { userId: user.sub, companyId }, select: { companyId: true } }))) {
    return NextResponse.json({ erro: 'Empresa não encontrada' }, { status: 404 })
  }
  const itensExistentes = await prisma.stockItem.findMany({
    where: { companyId, ativo: true },
    select: { id: true, nome: true, unidadeControle: true, categoria: true },
    orderBy: { nome: 'asc' },
    take: 200,
  })
  return NextResponse.json({ preview: buildPreviewConference(), itensExistentes })
}
