// ESTOQUE FASE 1 — GET ficha do produto (lê o ledger). Só lê.

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { buildFichaItem } from '@/lib/stock/ficha-item'

interface Params { params: Promise<{ id: string; itemId: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId, itemId } = await params
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Sessão expirada', code: 'AUTH_REQUIRED' }, { status: 401 })
  if (!(await prisma.userCompany.findFirst({ where: { userId: user.sub, companyId }, select: { companyId: true } }))) {
    return NextResponse.json({ erro: 'Empresa não encontrada' }, { status: 404 })
  }
  const ficha = await buildFichaItem(companyId, itemId)
  if (!ficha) return NextResponse.json({ erro: 'Item não encontrado' }, { status: 404 })
  return NextResponse.json({ ficha })
}
