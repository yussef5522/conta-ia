// ESTOQUE PARTE C — GET relatório de perdas do período (por motivo e por item).

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { relatorioPerdas } from '@/lib/stock/saida'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Sessão expirada', code: 'AUTH_REQUIRED' }, { status: 401 })
  if (!(await prisma.userCompany.findFirst({ where: { userId: user.sub, companyId }, select: { companyId: true } }))) {
    return NextResponse.json({ erro: 'Empresa não encontrada' }, { status: 404 })
  }
  const sp = request.nextUrl.searchParams
  const hoje = new Date()
  const ate = sp.get('ate') || hoje.toISOString().slice(0, 10)
  const de = sp.get('de') || new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10)
  return NextResponse.json({ relatorio: await relatorioPerdas(companyId, de, ate, prisma) })
}
