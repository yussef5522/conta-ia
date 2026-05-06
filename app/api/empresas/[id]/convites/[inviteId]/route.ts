import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api/handle-error'

interface Params {
  params: Promise<{ id: string; inviteId: string }>
}

// DELETE /api/empresas/[id]/convites/[inviteId]
// Cancela convite pendente. Convites já aceitos não podem ser cancelados.
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId, inviteId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('user.invite')

    const invite = await prisma.companyInvite.findUnique({
      where: { id: inviteId },
    })

    if (!invite) {
      return NextResponse.json({ erro: 'Convite não encontrado' }, { status: 404 })
    }

    // Multi-tenant: convite precisa ser da empresa
    if (invite.companyId !== companyId) {
      return NextResponse.json({ erro: 'Convite não encontrado' }, { status: 404 })
    }

    if (invite.acceptedAt) {
      return NextResponse.json(
        { erro: 'Convite já foi aceito. Não pode ser cancelado.' },
        { status: 400 },
      )
    }

    await prisma.companyInvite.delete({ where: { id: inviteId } })

    await logAudit(ctx, {
      action: 'DELETE',
      entityType: 'CompanyInvite',
      entityId: inviteId,
      metadata: {
        email: invite.email,
        cancelled: true,
      },
      request,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}
