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
} from '@/lib/invites/helpers'

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
// Gera convite com token. NÃO envia email — frontend mostra link pra copiar.
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
      select: { id: true, name: true, isSystemDefault: true, companyId: true },
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

    return NextResponse.json(
      {
        invite: {
          id: invite.id,
          email: invite.email,
          token: invite.token,
          expiresAt: invite.expiresAt,
          inviteUrl,
        },
      },
      { status: 201 },
    )
  } catch (error) {
    return handleApiError(error)
  }
}
