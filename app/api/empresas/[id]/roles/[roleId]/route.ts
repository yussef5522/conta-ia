import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { logAudit, diffFields, type FieldsChanged } from '@/lib/audit'
import { handleApiError } from '@/lib/api/handle-error'
import { roleUpdateSchema, diffPermissions } from '@/lib/roles/validation'

interface Params {
  params: Promise<{ id: string; roleId: string }>
}

// PUT /api/empresas/[id]/roles/[roleId]
// Edita role custom. System defaults BLOQUEADAS (403).
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId, roleId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('role.update')

    const role = await prisma.role.findUnique({
      where: { id: roleId },
      include: {
        permissions: { include: { permission: true } },
      },
    })

    if (!role) {
      return NextResponse.json({ erro: 'Role não encontrada' }, { status: 404 })
    }

    if (role.isSystemDefault) {
      return NextResponse.json(
        { erro: 'Roles do sistema não podem ser editadas. Crie uma role customizada.' },
        { status: 403 },
      )
    }

    if (role.companyId !== companyId) {
      return NextResponse.json({ erro: 'Role não encontrada' }, { status: 404 })
    }

    const body = await request.json()
    const data = roleUpdateSchema.parse(body)

    // Conflito de nome (se está trocando)
    if (data.name && data.name !== role.name) {
      const existing = await prisma.role.findFirst({
        where: {
          name: data.name,
          id: { not: roleId },
          OR: [{ companyId }, { isSystemDefault: true, companyId: null }],
        },
      })

      if (existing) {
        return NextResponse.json(
          { erro: `Já existe uma role com o nome "${data.name}".` },
          { status: 400 },
        )
      }
    }

    const beforePermKeys = role.permissions.map((rp) => rp.permission.key).sort()

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Atualiza dados básicos
      const updateData: Record<string, unknown> = {}
      if (data.name !== undefined) updateData.name = data.name
      if (data.description !== undefined) updateData.description = data.description ?? null

      const newRole =
        Object.keys(updateData).length > 0
          ? await tx.role.update({ where: { id: roleId }, data: updateData })
          : role

      // 2. Sincroniza permissions se enviado
      let afterPermKeys = beforePermKeys
      if (data.permissionKeys !== undefined) {
        const newPermissions = await tx.permission.findMany({
          where: { key: { in: data.permissionKeys } },
          select: { id: true, key: true },
        })

        if (newPermissions.length !== data.permissionKeys.length) {
          const foundKeys = new Set(newPermissions.map((p) => p.key))
          const missing = data.permissionKeys.filter((k) => !foundKeys.has(k))
          throw new Error(`Permissions não encontradas: ${missing.join(', ')}`)
        }

        // Replace simples: delete tudo + insert novo set (mais simples que diff)
        await tx.rolePermission.deleteMany({ where: { roleId } })
        if (newPermissions.length > 0) {
          await tx.rolePermission.createMany({
            data: newPermissions.map((p) => ({ roleId, permissionId: p.id })),
          })
        }

        afterPermKeys = data.permissionKeys.slice().sort()
      }

      // 3. Audit log: campos básicos + diff de permissions
      const fieldsChanged: FieldsChanged =
        diffFields(
          { name: role.name, description: role.description },
          { name: newRole.name, description: newRole.description },
          ['name', 'description'],
        ) ?? {}

      const permsDiff = diffPermissions(beforePermKeys, afterPermKeys)
      if (permsDiff.added.length > 0 || permsDiff.removed.length > 0) {
        fieldsChanged['permissions'] = {
          before: beforePermKeys,
          after: afterPermKeys,
        }
      }

      if (Object.keys(fieldsChanged).length > 0) {
        await logAudit(
          ctx,
          {
            action: 'UPDATE',
            entityType: 'Role',
            entityId: roleId,
            fieldsChanged,
            metadata: {
              name: newRole.name,
              permissionsAdded: permsDiff.added,
              permissionsRemoved: permsDiff.removed,
            },
            request,
          },
          tx,
        )
      }

      return { ...newRole, permissionKeys: afterPermKeys }
    })

    return NextResponse.json({
      role: {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        isSystemDefault: false,
        companyId: updated.companyId,
        permissionKeys: updated.permissionKeys,
        permissionCount: updated.permissionKeys.length,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/empresas/[id]/roles/[roleId]
// Exclui role custom. System defaults BLOQUEADAS. Role com users BLOQUEIA.
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId, roleId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('role.delete')

    const role = await prisma.role.findUnique({
      where: { id: roleId },
      include: {
        userCompanyRoles: {
          where: { companyId },
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    })

    if (!role) {
      return NextResponse.json({ erro: 'Role não encontrada' }, { status: 404 })
    }

    if (role.isSystemDefault) {
      return NextResponse.json(
        { erro: 'Roles do sistema não podem ser excluídas.' },
        { status: 403 },
      )
    }

    if (role.companyId !== companyId) {
      return NextResponse.json({ erro: 'Role não encontrada' }, { status: 404 })
    }

    // Bloqueia exclusão se tiver users — frontend mostra lista pra reatribuir
    if (role.userCompanyRoles.length > 0) {
      const users = role.userCompanyRoles.map((ucr) => ({
        id: ucr.user.id,
        name: ucr.user.name,
        email: ucr.user.email,
      }))

      return NextResponse.json(
        {
          erro: `Esta role tem ${users.length} usuário(s) ativo(s). Reatribua antes de excluir.`,
          users,
        },
        { status: 400 },
      )
    }

    const snapshot = {
      name: role.name,
      description: role.description,
    }

    await prisma.role.delete({ where: { id: roleId } })

    await logAudit(ctx, {
      action: 'DELETE',
      entityType: 'Role',
      entityId: roleId,
      metadata: snapshot,
      request,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}
