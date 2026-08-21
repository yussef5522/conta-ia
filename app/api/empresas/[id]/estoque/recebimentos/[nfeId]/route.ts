// ESTOQUE FASE 1 item 2 — GET conferência da NOTA REAL (read-only; CONFIRMAR ainda
// desligado). Só lê stock_nfe/item/emit + mapeamentos. Nenhuma escrita.

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { buildConferenceView } from '@/lib/stock/conference'

interface Params { params: Promise<{ id: string; nfeId: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId, nfeId } = await params
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Sessão expirada', code: 'AUTH_REQUIRED' }, { status: 401 })
  if (!(await prisma.userCompany.findFirst({ where: { userId: user.sub, companyId }, select: { companyId: true } }))) {
    return NextResponse.json({ erro: 'Empresa não encontrada' }, { status: 404 })
  }
  const [conference, itensExistentes] = await Promise.all([
    buildConferenceView(companyId, nfeId),
    prisma.stockItem.findMany({ where: { companyId, ativo: true }, select: { id: true, nome: true, unidadeControle: true, categoria: true }, orderBy: { nome: 'asc' }, take: 300 }),
  ])
  if (!conference) return NextResponse.json({ erro: 'Nota não encontrada' }, { status: 404 })
  return NextResponse.json({ conference, itensExistentes })
}
