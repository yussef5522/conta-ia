// Sprint Cartao-A-Classificar (14/08/2026) — GET stats da fila "A CLASSIFICAR".
// Pra a tela GRITAR (contador visível). ?cardId= filtra por cartão (pro lote).

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getReviewQueue } from '@/lib/credit-card-pj/review-queue'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ erro: 'Não autenticado', code: 'AUTH_REQUIRED' }, { status: 401 })
  }
  const acesso = await prisma.userCompany.findFirst({
    where: { userId: user.sub, companyId },
    select: { companyId: true },
  })
  if (!acesso) return NextResponse.json({ erro: 'Empresa não encontrada' }, { status: 404 })

  const cardId = request.nextUrl.searchParams.get('cardId') ?? undefined
  const q = await getReviewQueue(prisma, companyId, cardId)
  return NextResponse.json(q)
}
