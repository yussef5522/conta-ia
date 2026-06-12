// Fase 4 — GET /api/import-warnings?empresaId=X
// Lista warnings não-revisados (dismissedAt IS NULL AND resolvedAt IS NULL).

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ erro: 'Não autenticado', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  const empresaId = request.nextUrl.searchParams.get('empresaId')
  if (!empresaId) {
    return NextResponse.json({ erro: 'empresaId obrigatório' }, { status: 400 })
  }

  // Multi-tenant: user precisa ter acesso à empresa
  const access = await prisma.userCompany.findFirst({
    where: { userId: user.sub, companyId: empresaId },
    select: { userId: true },
  })
  if (!access) {
    return NextResponse.json({ erro: 'Acesso negado', code: 'FORBIDDEN' }, { status: 403 })
  }

  const warnings = await prisma.importWarning.findMany({
    where: {
      companyId: empresaId,
      dismissedAt: null,
      resolvedAt: null,
    },
    orderBy: { detectedAt: 'desc' },
    take: 200,
    include: {
      bankAccount: { select: { id: true, name: true } },
      newTx: {
        select: {
          id: true, amount: true, date: true, description: true, type: true,
          externalId: true, createdAt: true, bankAccountId: true,
        },
      },
      suspectedDup: {
        select: {
          id: true, amount: true, date: true, description: true, type: true,
          externalId: true, createdAt: true,
        },
      },
    },
  })

  return NextResponse.json({ warnings, count: warnings.length })
}
