// Fase 4 — POST /api/import-warnings/[id]/dismiss
// User decidiu "não é dup, ignorar". Apenas marca dismissedAt — não deleta tx.

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

interface Params { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const { id: warningId } = await params
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ erro: 'Não autenticado', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  const warning = await prisma.importWarning.findUnique({
    where: { id: warningId },
    select: { id: true, companyId: true, dismissedAt: true, resolvedAt: true },
  })
  if (!warning) {
    return NextResponse.json({ erro: 'Warning não encontrado', code: 'NOT_FOUND' }, { status: 404 })
  }

  // Multi-tenant
  const access = await prisma.userCompany.findFirst({
    where: { userId: user.sub, companyId: warning.companyId },
    select: { userId: true },
  })
  if (!access) {
    return NextResponse.json({ erro: 'Acesso negado', code: 'FORBIDDEN' }, { status: 403 })
  }

  // Idempotente
  if (warning.dismissedAt || warning.resolvedAt) {
    return NextResponse.json({ ok: true, alreadyResolved: true })
  }

  const updated = await prisma.importWarning.update({
    where: { id: warningId },
    data: {
      dismissedAt: new Date(),
      dismissedById: user.sub,
      resolution: 'DISMISSED',
    },
  })

  return NextResponse.json({ ok: true, warning: updated })
}
