// Sprint 4.0.5.b — Usuários global. Lê empresa do cookie + perm user.invite.

import type { Metadata } from 'next'
import { UsuariosClient } from '@/app/(dashboard)/empresas/[id]/usuarios/usuarios-client'
import { resolveEmpresaAccess } from '@/lib/auth/resolve-empresa-access'
import { permissionMatches } from '@/lib/auth/permissions'
import {
  NoEmpresaSelectedState,
  NoAccessState,
  ForbiddenState,
} from '@/components/empresa/empty-empresa-state'

export const metadata: Metadata = { title: 'Usuários' }

export default async function UsuariosPage() {
  const access = await resolveEmpresaAccess({ requirePermission: 'user.invite' })
  if (access.kind === 'no-empresa-selected') return <NoEmpresaSelectedState />
  if (access.kind === 'no-access') return <NoAccessState />
  if (access.kind === 'forbidden') return <ForbiddenState permission={access.missingPermission} />

  return (
    <UsuariosClient
      empresaId={access.empresaId}
      empresaNome={access.empresa.tradeName ?? access.empresa.name}
      currentUserId={access.userId}
      canRemove={permissionMatches(access.permissions, 'user.remove')}
      canAssignRole={permissionMatches(access.permissions, 'user.assign_role')}
    />
  )
}
