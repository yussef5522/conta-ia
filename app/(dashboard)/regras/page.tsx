// Sprint 4.0.5.b — Regras IA global. Lê empresa do cookie.

import type { Metadata } from 'next'
import { prisma } from '@/lib/db'
import { RegrasClient } from '@/app/(dashboard)/empresas/[id]/regras/regras-client'
import { resolveEmpresaAccess } from '@/lib/auth/resolve-empresa-access'
import {
  NoEmpresaSelectedState,
  NoAccessState,
} from '@/components/empresa/empty-empresa-state'

export const metadata: Metadata = { title: 'Regras Aprendidas' }
export const dynamic = 'force-dynamic'

export default async function RegrasPage() {
  const access = await resolveEmpresaAccess()
  if (access.kind === 'no-empresa-selected') return <NoEmpresaSelectedState />
  if (access.kind === 'no-access') return <NoAccessState />
  if (access.kind === 'forbidden') return <NoAccessState />

  const categorias = await prisma.category.findMany({
    where: { companyId: access.empresaId, isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, type: true, dreGroup: true, color: true },
  })

  return (
    <RegrasClient
      empresaId={access.empresaId}
      empresaNome={access.empresa.tradeName ?? access.empresa.name}
      categorias={categorias}
    />
  )
}
