// ESTOQUE FASE 2 item 2.0 — GET itens (busca pro editor de ficha). id/nome/unidade/custo.

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Sessão expirada', code: 'AUTH_REQUIRED' }, { status: 401 })
  if (!(await prisma.userCompany.findFirst({ where: { userId: user.sub, companyId }, select: { companyId: true } }))) {
    return NextResponse.json({ erro: 'Empresa não encontrada' }, { status: 404 })
  }
  const busca = request.nextUrl.searchParams.get('busca')?.trim() ?? ''
  const itens = await prisma.stockItem.findMany({
    where: { companyId, ativo: true, ...(busca ? { nome: { contains: busca } } : {}) },
    orderBy: { nome: 'asc' },
    take: 50,
    select: { id: true, nome: true, unidadeControle: true, custoMedio: true, categoria: true },
  })
  return NextResponse.json({ itens })
}
