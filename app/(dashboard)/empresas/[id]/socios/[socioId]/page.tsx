// Sprint Unificar Sócios — Detalhe do sócio.
// Server component, auth via resolveEmpresaAccess.

import type { Metadata } from 'next'
import { resolveEmpresaAccess } from '@/lib/auth/resolve-empresa-access'
import {
  NoEmpresaSelectedState,
  NoAccessState,
} from '@/components/empresa/empty-empresa-state'
import { SocioDetailClient } from './socio-detail-client'

export const metadata: Metadata = { title: 'Sócio · Detalhe' }
export const dynamic = 'force-dynamic'

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; socioId: string }>
}) {
  const { id: empresaId, socioId } = await params
  const access = await resolveEmpresaAccess()
  if (access.kind === 'no-empresa-selected') return <NoEmpresaSelectedState />
  if (access.kind === 'no-access') return <NoAccessState />
  if (access.kind === 'forbidden') return <NoAccessState />

  return (
    <SocioDetailClient
      empresaId={empresaId}
      empresaNome={access.empresa.tradeName ?? access.empresa.name}
      socioId={socioId}
    />
  )
}
