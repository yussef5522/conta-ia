// Seed de Permissions + Roles padrão (Sub-etapa 5.3.A).
// IDEMPOTENTE: rodar 2x não duplica nada.
// APENAS INSERT/UPDATE — nunca deleta dados de empresa.

import { PrismaClient } from '@prisma/client'
import { PERMISSIONS, DEFAULT_ROLES, expandPermissions } from '../lib/auth/permissions'

const prisma = new PrismaClient()

async function seedPermissions() {
  console.log('📋 Seeding permissions...')

  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: p.key },
      create: p,
      update: { name: p.name, description: p.description, group: p.group },
    })
  }

  console.log(`   ✅ ${PERMISSIONS.length} permissions sincronizadas.`)
}

async function seedDefaultRoles() {
  console.log('🛡️  Seeding roles padrão...')

  for (const [, def] of Object.entries(DEFAULT_ROLES)) {
    let role = await prisma.role.findFirst({
      where: { name: def.name, companyId: null, isSystemDefault: true },
    })

    if (!role) {
      role = await prisma.role.create({
        data: {
          name: def.name,
          description: def.description,
          isSystemDefault: true,
          companyId: null,
        },
      })
      console.log(`   ✅ Role criada: ${def.name}`)
    } else {
      await prisma.role.update({
        where: { id: role.id },
        data: { description: def.description },
      })
      console.log(`   🔄 Role atualizada: ${def.name}`)
    }

    const expandedPerms = expandPermissions([...def.permissions])
    const permissions = await prisma.permission.findMany({
      where: { key: { in: expandedPerms } },
    })

    // Remove RolePermissions que não estão mais na lista esperada
    await prisma.rolePermission.deleteMany({
      where: {
        roleId: role.id,
        permissionId: { notIn: permissions.map((p) => p.id) },
      },
    })

    // Adiciona/mantém permissões esperadas (idempotente via upsert)
    for (const perm of permissions) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
        create: { roleId: role.id, permissionId: perm.id },
        update: {},
      })
    }

    console.log(`      🔑 ${permissions.length} permissions atribuídas`)
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════')
  console.log('  SEED RBAC — Sub-etapa 5.3.A')
  console.log('═══════════════════════════════════════════════\n')

  await seedPermissions()
  console.log('')
  await seedDefaultRoles()

  console.log('\n✅ Seed concluído!\n')
}

main()
  .catch((e) => {
    console.error('❌ ERRO:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
