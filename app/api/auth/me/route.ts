import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)

  if (!user) {
    return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.sub },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  })

  if (!dbUser) {
    return NextResponse.json({ erro: 'Usuário não encontrado' }, { status: 404 })
  }

  return NextResponse.json({ usuario: dbUser })
}
