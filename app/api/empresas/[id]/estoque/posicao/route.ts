// ESTOQUE FASE 1 item 2 — GET posição de estoque (saldo derivado). Só lê.

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { listPosicao } from '@/lib/stock/posicao'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Sessão expirada', code: 'AUTH_REQUIRED' }, { status: 401 })
  if (!(await prisma.userCompany.findFirst({ where: { userId: user.sub, companyId }, select: { companyId: true } }))) {
    return NextResponse.json({ erro: 'Empresa não encontrada' }, { status: 404 })
  }
  return NextResponse.json({ posicao: await listPosicao(companyId) })
}
