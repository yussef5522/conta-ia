// Sprint PF FATIA 1 — Marca onboarding como completado.
// User só marca PRA SI MESMO (session.sub) — multi-tenant rígido.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  }
  await prisma.user.update({
    where: { id: user.sub },
    data: { onboardingCompletedAt: new Date() },
  })
  return NextResponse.json({ ok: true })
}

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  }
  const u = await prisma.user.findUnique({
    where: { id: user.sub },
    select: { onboardingCompletedAt: true, createdAt: true },
  })
  return NextResponse.json({
    completed: !!u?.onboardingCompletedAt,
    completedAt: u?.onboardingCompletedAt,
  })
}
