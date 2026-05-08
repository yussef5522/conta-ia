import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'

interface Params {
  params: Promise<{ id: string }>
}

// GET /api/empresas/[id]/me
//
// Retorna dados do user atual no contexto da empresa:
// - user (id, name, email)
// - company (id, name, tradeName, sector se existir)
// - role (id, name, isSystemDefault)
// - permissions (lista de keys, expandidas)
//
// Usado pela sidebar contextual para filtrar menu por permissions.
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId } = await params
    const ctx = await getAuthContext(request, companyId)

    // ctx.company só tem { id }; busca name/tradeName via prisma.
    // (schema Company não tem `sector` — retorna null pra manter contrato.)
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, tradeName: true },
    })

    if (!company) {
      return NextResponse.json({ erro: 'Empresa não encontrada' }, { status: 404 })
    }

    return NextResponse.json({
      user: {
        id: ctx.user.id,
        name: ctx.user.name,
        email: ctx.user.email,
      },
      company: {
        id: company.id,
        name: company.name,
        tradeName: company.tradeName ?? null,
        sector: null,
      },
      role: ctx.role
        ? {
            id: ctx.role.id,
            name: ctx.role.name,
            isSystemDefault: ctx.role.isSystemDefault,
          }
        : null,
      permissions: ctx.permissions,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
