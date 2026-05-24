// Sprint 4.0.5.b — Permissões global. Lê empresa do cookie + perm role.view.

import type { Metadata } from 'next'
import { PermissoesClient } from '@/app/(dashboard)/empresas/[id]/permissoes/permissoes-client'
import { resolveEmpresaAccess } from '@/lib/auth/resolve-empresa-access'
import { permissionMatches } from '@/lib/auth/permissions'
import {
  NoEmpresaSelectedState,
  NoAccessState,
  ForbiddenState,
} from '@/components/empresa/empty-empresa-state'

export const metadata: Metadata = { title: 'Roles e Permissões' }

export default async function PermissoesPage() {
  const access = await resolveEmpresaAccess({ requirePermission: 'role.view' })
  if (access.kind === 'no-empresa-selected') return <NoEmpresaSelectedState />
  if (access.kind === 'no-access') return <NoAccessState />
  if (access.kind === 'forbidden') return <ForbiddenState permission={access.missingPermission} />

  return (
    <PermissoesClient
      empresaId={access.empresaId}
      empresaNome={access.empresa.tradeName ?? access.empresa.name}
      canCreate={permissionMatches(access.permissions, 'role.create')}
      canUpdate={permissionMatches(access.permissions, 'role.update')}
      canDelete={permissionMatches(access.permissions, 'role.delete')}
    />
  )
}
