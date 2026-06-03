// Sprint PF Fatia 3 — GET histórico de imports.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import {
  checkProfileAccess,
  ProfileAccessError,
} from '@/lib/personal-profile/queries'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  const { id } = await params
  try {
    await checkProfileAccess(user.sub, id)
    const imports = await prisma.personalOfxImport.findMany({
      where: { profileId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { creditCard: { select: { name: true, lastDigits: true } } },
    })
    return NextResponse.json({ imports })
  } catch (err) {
    if (err instanceof ProfileAccessError) {
      return NextResponse.json(
        { erro: err.message, code: err.code },
        { status: err.code === 'NO_ACCESS' ? 404 : 403 },
      )
    }
    throw err
  }
}
