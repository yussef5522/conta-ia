import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

interface Params { params: Promise<{ id: string }> }

// GET /api/empresas/[id]/categorias
// Lista categorias ativas da empresa, ordenadas por nome.
// Multi-tenancy: confirma que o usuário tem acesso à empresa antes de retornar.
export async function GET(request: NextRequest, { params }: Params) {
  const { id: empresaId } = await params
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  try {
    const acesso = await prisma.userCompany.findFirst({
      where: { userId: user.sub, companyId: empresaId },
    })
    if (!acesso) return NextResponse.json({ erro: 'Empresa não encontrada' }, { status: 404 })

    const categorias = await prisma.category.findMany({
      where: { companyId: empresaId, isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        type: true,
        color: true,
        icon: true,
        isDefault: true,
      },
    })

    return NextResponse.json({ categorias })
  } catch (error) {
    console.error('[CATEGORIAS GET] Erro:', error)
    return NextResponse.json({ erro: 'Erro ao buscar categorias' }, { status: 500 })
  }
}
