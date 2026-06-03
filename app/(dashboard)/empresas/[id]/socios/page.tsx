// Sprint Unificar Sócios — entry point da nova tela unificada.
// Server component que faz auth + delega ao client component.

import type { Metadata } from 'next'
import { resolveEmpresaAccess } from '@/lib/auth/resolve-empresa-access'
import {
  NoEmpresaSelectedState,
  NoAccessState,
} from '@/components/empresa/empty-empresa-state'
import { SociosUnifiedClient } from './socios-unified-client'

export const metadata: Metadata = { title: 'Sócios' }
export const dynamic = 'force-dynamic'

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: paramEmpresaId } = await params
  const access = await resolveEmpresaAccess()
  if (access.kind === 'no-empresa-selected') return <NoEmpresaSelectedState />
  if (access.kind === 'no-access') return <NoAccessState />
  if (access.kind === 'forbidden') return <NoAccessState />

  // Garante que o param da URL bate com o cookie current_empresa_id
  // (se vier rota direta de empresa diferente, prefere a URL).
  const empresaId = paramEmpresaId || access.empresaId

  return (
    <SociosUnifiedClient
      empresaId={empresaId}
      empresaNome={access.empresa.tradeName ?? access.empresa.name}
    />
  )
}
