import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api/handle-error'

interface Params {
  params: Promise<{ id: string; userId: string }>
}

// DELETE /api/empresas/[id]/usuarios/[userId]
// Remove user da empresa. NÃO deleta o user — apenas remove UserCompanyRole.
//
// Validações:
// - User não pode remover a si mesmo
// - Não pode remover último OWNER
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId, userId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('user.remove')

    // User não pode remover a si mesmo (deixa pra fluxo "Sair da empresa" v2)
    if (userId === ctx.user.id) {
      return NextResponse.json(
        { erro: 'Você não pode remover a si mesmo da empresa.' },
        { status: 400 },
      )
    }

    const ucr = await prisma.userCompanyRole.findFirst({
      where: { userId, companyId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        role: { select: { id: true, name: true, isSystemDefault: true } },
      },
    })

    if (!ucr) {
      return NextResponse.json({ erro: 'Usuário não encontrado na empresa' }, { status: 404 })
    }

    // Não pode remover último OWNER
    const isOwner = ucr.role.name === 'OWNER' && ucr.role.isSystemDefault
    if (isOwner) {
      const ownerCount = await prisma.userCompanyRole.count({
        where: {
          companyId,
          role: { name: 'OWNER', isSystemDefault: true, companyId: null },
        },
      })

      if (ownerCount === 1) {
        return NextResponse.json(
          { erro: 'Não é possível remover o último OWNER da empresa.' },
          { status: 400 },
        )
      }
    }

    const snapshot = {
      userName: ucr.user.name,
      userEmail: ucr.user.email,
      roleName: ucr.role.name,
    }

    await prisma.$transaction(async (tx) => {
      await tx.userCompanyRole.delete({ where: { id: ucr.id } })

      await logAudit(
        ctx,
        {
          action: 'DELETE',
          entityType: 'UserCompanyRole',
          entityId: ucr.id,
          metadata: snapshot,
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
