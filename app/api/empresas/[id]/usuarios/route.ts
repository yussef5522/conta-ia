import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api/handle-error'
import {
  inviteCreateSchema,
  generateInviteToken,
  calculateExpiration,
  buildInviteUrl,
  INVITE_EXPIRES_DAYS,
} from '@/lib/invites/helpers'
import { sendEmail } from '@/lib/email/send'
import { renderTeamInviteHtml } from '@/lib/email/render'

interface Params {
  params: Promise<{ id: string }>
}

// GET /api/empresas/[id]/usuarios
// Lista users ativos + convites pendentes (não expirados, não aceitos).
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('user.invite')

    const [userRoles, pendingInvites] = await Promise.all([
      prisma.userCompanyRole.findMany({
        where: { companyId },
        include: {
          user: { select: { id: true, name: true, email: true, createdAt: true } },
          role: {
            select: { id: true, name: true, isSystemDefault: true, description: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.companyInvite.findMany({
        where: {
          companyId,
          acceptedAt: null,
          expiresAt: { gt: new Date() },
        },
        include: {
          role: { select: { id: true, name: true, isSystemDefault: true } },
          invitedBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    const users = userRoles.map((ucr) => ({
      id: ucr.user.id,
      userCompanyRoleId: ucr.id,
      name: ucr.user.name,
      email: ucr.user.email,
      role: ucr.role,
      addedAt: ucr.createdAt,
    }))

    const invites = pendingInvites.map((inv) => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      invitedBy: inv.invitedBy
        ? { name: inv.invitedBy.name, email: inv.invitedBy.email }
        : null,
      expiresAt: inv.expiresAt,
      createdAt: inv.createdAt,
    }))

    return NextResponse.json({ users, invites })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/empresas/[id]/usuarios
// Gera convite com token + envia email via Resend (Sprint 1.5).
// Resposta inclui inviteUrl pra UI mostrar fallback "copiar link".
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('user.invite')

    const body = await request.json()
    const data = inviteCreateSchema.parse(body)

    // 1. Role precisa existir e ser elegível (system default OU custom da empresa)
    const role = await prisma.role.findUnique({
      where: { id: data.roleId },
      select: {
        id: true,
        name: true,
        isSystemDefault: true,
        companyId: true,
        description: true,
      },
    })

    if (!role) {
      return NextResponse.json({ erro: 'Role não encontrada' }, { status: 400 })
    }

    if (!role.isSystemDefault && role.companyId !== companyId) {
      return NextResponse.json({ erro: 'Role inválida pra esta empresa' }, { status: 400 })
    }

    // 2. Email já tem acesso à empresa?
    const existingMember = await prisma.userCompanyRole.findFirst({
      where: {
        companyId,
        user: { email: data.email },
      },
      include: { user: { select: { email: true } } },
    })

    if (existingMember) {
      return NextResponse.json(
        { erro: `${data.email} já tem acesso à empresa.` },
        { status: 400 },
      )
    }

    // 3. Já existe convite pendente pra esse email?
    const pendingInvite = await prisma.companyInvite.findFirst({
      where: {
        companyId,
        email: data.email,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    })

    if (pendingInvite) {
      return NextResponse.json(
        {
          erro: `Já existe convite pendente pra ${data.email}. Cancele o anterior ou aguarde expirar.`,
          existingInviteId: pendingInvite.id,
        },
        { status: 400 },
      )
    }

    // 4. Cria convite + audit log atomicamente
    const token = generateInviteToken()
    const expiresAt = calculateExpiration()

    const invite = await prisma.$transaction(async (tx) => {
      const created = await tx.companyInvite.create({
        data: {
          companyId,
          email: data.email,
          roleId: data.roleId,
          token,
          expiresAt,
          invitedById: ctx.user.id,
        },
      })

      await logAudit(
        ctx,
        {
          action: 'CREATE',
          entityType: 'CompanyInvite',
          entityId: created.id,
          metadata: {
            email: data.email,
            roleName: role.name,
            roleId: role.id,
          },
          request,
        },
        tx,
      )

      return created
    })

    // Sprint 1.4 fix: usar X-Forwarded-Host/Proto enviados pelo nginx.
    // request.nextUrl.origin retorna o origin INTERNO (localhost:3001) e
    // ignora o proxy reverso → inviteUrl ficava com URL não-pública.
    const forwardedHost =
      request.headers.get('x-forwarded-host') ?? request.headers.get('host')
    const forwardedProto =
      request.headers.get('x-forwarded-proto') ?? 'https'
    const baseUrl = forwardedHost
      ? `${forwardedProto}://${forwardedHost}`
      : request.nextUrl.origin
    const inviteUrl = buildInviteUrl(baseUrl, token)

    // Sprint 1.5 — envia email via Resend.
    // Não bloqueia a resposta caso email falhe (frontend ainda tem inviteUrl
    // pra fallback "copiar link" / WhatsApp).
    let emailSent = false
    let emailError: string | undefined
    try {
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { name: true, tradeName: true },
      })
      const inviterName = ctx.user.name ?? ctx.user.email ?? 'Alguém'
      const html = await renderTeamInviteHtml({
        inviterName,
        companyName: company?.tradeName ?? company?.name ?? 'Sua empresa',
        roleName: role.name,
        roleDescription: role.description,
        inviteUrl,
        expiresInDays: INVITE_EXPIRES_DAYS,
      })
      const result = await sendEmail({
        to: invite.email,
        subject: `${inviterName} te convidou pra ${company?.tradeName ?? company?.name ?? 'CAIXAOS'}`,
        html,
        type: 'team-invite',
      })
      emailSent = result.success && !result.skipped
      if (!result.success) emailError = result.error

      // Audit do envio (não-fatal)
      try {
        await logAudit(
          ctx,
          {
            action: emailSent ? 'TEAM_INVITE_SENT' : 'EMAIL_DELIVERY_FAILED',
            entityType: 'CompanyInvite',
            entityId: invite.id,
            metadata: {
              email: invite.email,
              emailSent,
              emailError,
              type: 'team-invite',
            },
            request,
          },
        )
      } catch {
        /* audit é best-effort */
      }
    } catch (err) {
      emailError = err instanceof Error ? err.message : 'erro desconhecido'
      console.error('[invite email] falha:', emailError)
    }

    return NextResponse.json(
      {
        invite: {
          id: invite.id,
          email: invite.email,
          token: invite.token,
          expiresAt: invite.expiresAt,
          inviteUrl,
          emailSent,
        },
      },
      { status: 201 },
    )
  } catch (error) {
    return handleApiError(error)
  }
}
