import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api/handle-error'
import { userRoleChangeSchema } from '@/lib/invites/helpers'

interface Params {
  params: Promise<{ id: string; userId: string }>
}

// PUT /api/empresas/[id]/usuarios/[userId]/role
// Muda role de um user na empresa.
//
// Validações:
// - User não pode mudar a própria role
// - Role nova precisa existir e ser elegível pra empresa
// - Não pode rebaixar último OWNER
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId, userId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('user.assign_role')

    const body = await request.json()
    const data = userRoleChangeSchema.parse(body)

    // Não pode mudar a própria role (deixa pra "Transferir titularidade" v2)
    if (userId === ctx.user.id) {
      return NextResponse.json(
        { erro: 'Você não pode mudar a sua própria role.' },
        { status: 400 },
      )
    }

    const currentUcr = await prisma.userCompanyRole.findFirst({
      where: { userId, companyId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        role: { select: { id: true, name: true, isSystemDefault: true } },
      },
    })

    if (!currentUcr) {
      return NextResponse.json({ erro: 'Usuário não encontrado na empresa' }, { status: 404 })
    }

    // Sem mudança real
    if (currentUcr.roleId === data.roleId) {
      return NextResponse.json({ success: true, unchanged: true })
    }

    const newRole = await prisma.role.findUnique({
      where: { id: data.roleId },
      select: { id: true, name: true, isSystemDefault: true, companyId: true },
    })

    if (!newRole) {
      return NextResponse.json({ erro: 'Role não encontrada' }, { status: 400 })
    }

    if (!newRole.isSystemDefault && newRole.companyId !== companyId) {
      return NextResponse.json({ erro: 'Role inválida pra esta empresa' }, { status: 400 })
    }

    // Se está REBAIXANDO o último OWNER, bloqueia
    const isCurrentOwner = currentUcr.role.name === 'OWNER' && currentUcr.role.isSystemDefault
    const isBecomingOwner = newRole.name === 'OWNER' && newRole.isSystemDefault

    if (isCurrentOwner && !isBecomingOwner) {
      const ownerCount = await prisma.userCompanyRole.count({
        where: {
          companyId,
          role: { name: 'OWNER', isSystemDefault: true, companyId: null },
        },
      })

      if (ownerCount === 1) {
        return NextResponse.json(
          { erro: 'Não é possível rebaixar o último OWNER da empresa.' },
          { status: 400 },
        )
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.userCompanyRole.update({
        where: { id: currentUcr.id },
        data: { roleId: data.roleId },
      })

      await logAudit(
        ctx,
        {
          action: 'UPDATE',
          entityType: 'UserCompanyRole',
          entityId: currentUcr.id,
          fieldsChanged: {
            roleId: { before: currentUcr.roleId, after: data.roleId },
            roleName: { before: currentUcr.role.name, after: newRole.name },
          },
          metadata: {
            userName: currentUcr.user.name,
            userEmail: currentUcr.user.email,
          },
          request,
        },
        tx,
      )
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}
