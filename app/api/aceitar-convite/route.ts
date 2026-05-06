import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import { handleApiError } from '@/lib/api/handle-error'
import { acceptInviteSchema, getInviteStatus } from '@/lib/invites/helpers'

// POST /api/aceitar-convite
// User logado aceita convite via token. Email da conta DEVE bater com email
// do convite (case-insensitive).
//
// Esta rota é "semi-pública": aceita unauthenticated GET (pra mostrar info),
// mas o ATO de aceitar (POST) requer auth. Por isso usa getAuthUser direto
// em vez de getAuthContext (não temos companyId pra checar permission antes
// do user virar membro).
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token } = acceptInviteSchema.parse(body)

    const invite = await prisma.companyInvite.findUnique({
      where: { token },
      include: {
        company: { select: { id: true, name: true, tradeName: true } },
        role: { select: { id: true, name: true } },
      },
    })

    if (!invite) {
      return NextResponse.json(
        { erro: 'Convite não encontrado ou inválido.' },
        { status: 404 },
      )
    }

    const status = getInviteStatus(invite)
    if (status === 'ACCEPTED') {
      return NextResponse.json({ erro: 'Este convite já foi aceito.' }, { status: 400 })
    }
    if (status === 'EXPIRED') {
      return NextResponse.json(
        { erro: 'Este convite expirou. Peça um novo ao administrador.' },
        { status: 400 },
      )
    }

    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json(
        { erro: 'Faça login pra aceitar o convite.', requiresLogin: true },
        { status: 401 },
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: authUser.sub },
      select: { id: true, name: true, email: true },
    })

    if (!user) {
      return NextResponse.json({ erro: 'Usuário não encontrado.' }, { status: 401 })
    }

    // Email do convite precisa bater com email da conta (case-insensitive)
    if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
      return NextResponse.json(
        {
          erro: `Este convite é pra ${invite.email}, mas você está logado como ${user.email}. Faça logout e entre com o email correto.`,
        },
        { status: 400 },
      )
    }

    // Já é membro? (caso clique 2x ou já tenha acesso por outra rota)
    const existing = await prisma.userCompanyRole.findFirst({
      where: { userId: user.id, companyId: invite.companyId },
    })

    if (existing) {
      // Cleanup: marca convite como aceito mesmo assim
      await prisma.companyInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      })
      return NextResponse.json({
        success: true,
        alreadyMember: true,
        company: {
          id: invite.company.id,
          name: invite.company.tradeName ?? invite.company.name,
        },
      })
    }

    // Cria UCR + marca aceito + audit log atomicamente.
    // Audit log inline (não via logAudit) porque ainda não temos AuthContext —
    // user vira membro NESTA mesma transação.
    await prisma.$transaction(async (tx) => {
      const ucr = await tx.userCompanyRole.create({
        data: {
          userId: user.id,
          companyId: invite.companyId,
          roleId: invite.roleId,
        },
      })

      await tx.companyInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      })

      const ipAddress =
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()?.slice(0, 45) ??
        request.headers.get('x-real-ip')?.slice(0, 45) ??
        null
      const userAgent = request.headers.get('user-agent')?.slice(0, 500) ?? null

      await tx.auditLog.create({
        data: {
          companyId: invite.companyId,
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          action: 'CREATE',
          entityType: 'UserCompanyRole',
          entityId: ucr.id,
          metadata: JSON.stringify({
            fromInvite: invite.id,
            roleName: invite.role.name,
            invitedById: invite.invitedById,
          }),
          ipAddress,
          userAgent,
        },
      })
    })

    return NextResponse.json({
      success: true,
      company: {
        id: invite.company.id,
        name: invite.company.tradeName ?? invite.company.name,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// GET /api/aceitar-convite?token=X
// Valida token e retorna info do convite (pra UI mostrar antes de aceitar).
// PÚBLICO — não exige auth (usuário pode estar deslogado vindo de email).
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const token = url.searchParams.get('token')

    if (!token) {
      return NextResponse.json({ erro: 'Token ausente' }, { status: 400 })
    }

    const invite = await prisma.companyInvite.findUnique({
      where: { token },
      include: {
        company: { select: { id: true, name: true, tradeName: true } },
        role: { select: { id: true, name: true, description: true } },
        invitedBy: { select: { name: true, email: true } },
      },
    })

    if (!invite) {
      return NextResponse.json(
        { erro: 'Convite não encontrado ou inválido.' },
        { status: 404 },
      )
    }

    const status = getInviteStatus(invite)

    return NextResponse.json({
      invite: {
        email: invite.email,
        company: { name: invite.company.tradeName ?? invite.company.name },
        role: { name: invite.role.name, description: invite.role.description },
        invitedBy: invite.invitedBy ? { name: invite.invitedBy.name } : null,
        expiresAt: invite.expiresAt,
        status,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
