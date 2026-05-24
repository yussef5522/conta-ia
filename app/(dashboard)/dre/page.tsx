// Sprint 4.0.5.b — DRE Gerencial global. Lê empresa do cookie.

import type { Metadata } from 'next'
import { DREClient } from '@/app/(dashboard)/empresas/[id]/dre/dre-client'
import { resolveEmpresaAccess } from '@/lib/auth/resolve-empresa-access'
import {
  NoEmpresaSelectedState,
  NoAccessState,
  ForbiddenState,
} from '@/components/empresa/empty-empresa-state'

export const metadata: Metadata = { title: 'DRE Gerencial' }

export default async function DREPage() {
  const access = await resolveEmpresaAccess({ requirePermission: 'dre.view' })
  if (access.kind === 'no-empresa-selected') return <NoEmpresaSelectedState />
  if (access.kind === 'no-access') return <NoAccessState />
  if (access.kind === 'forbidden') return <ForbiddenState permission={access.missingPermission} />

  return (
    <DREClient
      empresaId={access.empresaId}
      empresaNome={access.empresa.tradeName ?? access.empresa.name}
    />
  )
}
