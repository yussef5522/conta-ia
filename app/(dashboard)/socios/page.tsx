// Sprint Unificar Sócios — Rota global que resolve via cookie current_empresa_id.
// Redirect 301 de /pessoas-vinculadas chega aqui e a gente joga pra
// /empresas/<id>/socios.

import { redirect } from 'next/navigation'
import { resolveEmpresaAccess } from '@/lib/auth/resolve-empresa-access'
import {
  NoEmpresaSelectedState,
  NoAccessState,
} from '@/components/empresa/empty-empresa-state'

export const dynamic = 'force-dynamic'

export default async function GlobalSociosPage() {
  const access = await resolveEmpresaAccess()
  if (access.kind === 'no-empresa-selected') return <NoEmpresaSelectedState />
  if (access.kind === 'no-access') return <NoAccessState />
  if (access.kind === 'forbidden') return <NoAccessState />
  redirect(`/empresas/${access.empresaId}/socios`)
}
