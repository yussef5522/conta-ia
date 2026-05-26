// Sprint 5.0.2.h — Cadastro de Sócios PF + Empresas Relacionadas.
//
// Sistema usa esses cadastros pra detectar automaticamente Pix entre relacionados:
//   - Pix para CPF de sócio → Distribuição de Lucros / Pró-labore
//   - Pix entre CNPJs do grupo → Transferência entre Contas (filtrada do DRE)

import type { Metadata } from 'next'
import { resolveEmpresaAccess } from '@/lib/auth/resolve-empresa-access'
import {
  NoEmpresaSelectedState,
  NoAccessState,
} from '@/components/empresa/empty-empresa-state'
import { PessoasVinculadasClient } from './pessoas-vinculadas-client'

export const metadata: Metadata = { title: 'Pessoas Vinculadas' }
export const dynamic = 'force-dynamic'

export default async function Page() {
  const access = await resolveEmpresaAccess()
  if (access.kind === 'no-empresa-selected') return <NoEmpresaSelectedState />
  if (access.kind === 'no-access') return <NoAccessState />
  if (access.kind === 'forbidden') return <NoAccessState />

  return (
    <PessoasVinculadasClient
      empresaId={access.empresaId}
      empresaNome={access.empresa.tradeName ?? access.empresa.name}
    />
  )
}
