// ESTOQUE FASE 1 item 4 — GET recibo da conferência (derivado do gravado). Só lê.

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { buildRecibo } from '@/lib/stock/recibo'

interface Params { params: Promise<{ id: string; conferenceId: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId, conferenceId } = await params
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Sessão expirada', code: 'AUTH_REQUIRED' }, { status: 401 })
  if (!(await prisma.userCompany.findFirst({ where: { userId: user.sub, companyId }, select: { companyId: true } }))) {
    return NextResponse.json({ erro: 'Empresa não encontrada' }, { status: 404 })
  }
  const recibo = await buildRecibo(companyId, conferenceId)
  if (!recibo) return NextResponse.json({ erro: 'Recibo não encontrado' }, { status: 404 })
  return NextResponse.json({ recibo })
}
