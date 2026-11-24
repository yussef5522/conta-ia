// ⭐⭐⭐ CARTÕES v3 (24/11/2026) — GET da PÁGINA de cartões: a carteira inteira em lote (R44/R45).
// ⚠️ Consultas CONSTANTES (`lerCarteira`) — o N+1 da lista antiga morreu. Só leitura.

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { lerCarteira } from '@/lib/credit-card-pj/carteira'
import { diaDoBrasil } from '@/lib/margem/dia'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ erro: 'Sessão expirada ou não autenticado', code: 'AUTH_REQUIRED' }, { status: 401 })
  }
  const acesso = await prisma.userCompany.findFirst({ where: { userId: user.sub, companyId }, select: { companyId: true } })
  if (!acesso) return NextResponse.json({ erro: 'Empresa não encontrada' }, { status: 404 })
  return NextResponse.json(await lerCarteira(companyId, diaDoBrasil(new Date())))
}
