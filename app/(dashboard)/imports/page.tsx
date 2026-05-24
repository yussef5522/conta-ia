// Sprint 4.0.5.b — Histórico de Imports global. Lê empresa do cookie.

import type { Metadata } from 'next'
import { prisma } from '@/lib/db'
import { ImportsClient } from '@/app/(dashboard)/empresas/[id]/imports/imports-client'
import { resolveEmpresaAccess } from '@/lib/auth/resolve-empresa-access'
import {
  NoEmpresaSelectedState,
  NoAccessState,
} from '@/components/empresa/empty-empresa-state'

export const metadata: Metadata = { title: 'Histórico de Imports' }
export const dynamic = 'force-dynamic'

export default async function ImportsPage() {
  const access = await resolveEmpresaAccess()
  if (access.kind === 'no-empresa-selected') return <NoEmpresaSelectedState />
  if (access.kind === 'no-access') return <NoAccessState />
  if (access.kind === 'forbidden') return <NoAccessState />

  const contas = await prisma.bankAccount.findMany({
    where: { companyId: access.empresaId, isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, bankName: true },
  })

  return (
    <ImportsClient
      empresaId={access.empresaId}
      empresaNome={access.empresa.tradeName ?? access.empresa.name}
      contas={contas}
    />
  )
}
