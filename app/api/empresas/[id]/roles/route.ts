import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api/handle-error'
import { roleCreateSchema } from '@/lib/roles/validation'

interface Params {
  params: Promise<{ id: string }>
}

// GET /api/empresas/[id]/roles
// Lista roles disponíveis pra empresa:
//   - System defaults (companyId = null, isSystemDefault = true)
//   - Custom da empresa (companyId = empresaId, isSystemDefault = false)
// Inclui count de users por role (filtrado por empresa).
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('role.view')

    const roles = await prisma.role.findMany({
      where: {
        OR: [{ isSystemDefault: true, companyId: null }, { companyId }],
      },
      include: {
        permissions: { include: { permission: true } },
        userCompanyRoles: {
          where: { companyId },
          select: { id: true },
        },
      },
      orderBy: [
        { isSystemDefault: 'desc' }, // sistema primeiro
        { name: 'asc' },
      ],
    })

    const formatted = roles.map((role) => ({
      id: role.id,
      name: role.name,
      description: role.description,
      isSystemDefault: role.isSystemDefault,
      companyId: role.companyId,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
      permissionKeys: role.permissions.map((rp) => rp.permission.key),
      permissionCount: role.permissions.length,
      userCount: role.userCompanyRoles.length,
    }))

    return NextResponse.json({ roles: formatted })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/empresas/[id]/roles
// Cria role custom pra empresa.
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('role.create')

    const body = await request.json()
    const data = roleCreateSchema.parse(body)

    // Conflito de nome (mesma empresa OU role do sistema com nome reservado)
    const existing = await prisma.role.findFirst({
      where: {
        name: data.name,
        OR: [{ companyId }, { isSystemDefault: true, companyId: null }],
      },
    })

    if (existing) {
      return NextResponse.json(
        { erro: `Já existe uma role com o nome "${data.name}".` },
        { status: 400 },
      )
    }

    // Resolve permissions canonical → IDs
    const permissions = await prisma.permission.findMany({
      where: { key: { in: data.permissionKeys } },
      select: { id: true, key: true },
    })

    if (permissions.length !== data.permissionKeys.length) {
      const foundKeys = new Set(permissions.map((p) => p.key))
      const missing = data.permissionKeys.filter((k) => !foundKeys.has(k))
      return NextResponse.json(
        { erro: `Permissions não encontradas: ${missing.join(', ')}` },
        { status: 400 },
      )
    }

    // Cria role + permissions atomicamente, com audit log na mesma transação
    const role = await prisma.$transaction(async (tx) => {
      const created = await tx.role.create({
        data: {
          name: data.name,
          description: data.description ?? null,
          isSystemDefault: false,
          companyId,
        },
      })

      if (permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: permissions.map((p) => ({
            roleId: created.id,
            permissionId: p.id,
          })),
        })
      }

      await logAudit(
        ctx,
        {
          action: 'CREATE',
          entityType: 'Role',
          entityId: created.id,
          metadata: {
            name: created.name,
            permissionCount: permissions.length,
            permissions: data.permissionKeys,
          },
          request,
        },
        tx,
      )

      return created
    })

    return NextResponse.json(
      {
        role: {
          id: role.id,
          name: role.name,
          description: role.description,
          isSystemDefault: false,
          companyId: role.companyId,
          permissionKeys: data.permissionKeys,
          permissionCount: permissions.length,
          userCount: 0,
        },
      },
      { status: 201 },
    )
  } catch (error) {
    return handleApiError(error)
  }
}
