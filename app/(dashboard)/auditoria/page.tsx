// Sprint 4.0.5.b — Auditoria global. Lê empresa do cookie + perm audit.view.

import type { Metadata } from 'next'
import { AuditoriaClient } from '@/app/(dashboard)/empresas/[id]/auditoria/auditoria-client'
import { resolveEmpresaAccess } from '@/lib/auth/resolve-empresa-access'
import { permissionMatches } from '@/lib/auth/permissions'
import {
  NoEmpresaSelectedState,
  NoAccessState,
  ForbiddenState,
} from '@/components/empresa/empty-empresa-state'

export const metadata: Metadata = { title: 'Auditoria' }

export default async function AuditoriaPage() {
  const access = await resolveEmpresaAccess({ requirePermission: 'audit.view' })
  if (access.kind === 'no-empresa-selected') return <NoEmpresaSelectedState />
  if (access.kind === 'no-access') return <NoAccessState />
  if (access.kind === 'forbidden') return <ForbiddenState permission={access.missingPermission} />

  const canExport = permissionMatches(access.permissions, 'audit.export')

  return (
    <AuditoriaClient
      empresaId={access.empresaId}
      empresaNome={access.empresa.tradeName ?? access.empresa.name}
      canExport={canExport}
    />
  )
}
