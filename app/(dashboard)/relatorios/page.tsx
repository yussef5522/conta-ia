// Sprint 5.0.4.0a — Index de Relatórios (global). Resolve empresa pelo cookie
// e redireciona pra rota per-empresa `/empresas/[id]/relatorios`.

import { redirect } from 'next/navigation'
import { resolveEmpresaAccess } from '@/lib/auth/resolve-empresa-access'
import {
  NoEmpresaSelectedState,
  NoAccessState,
  ForbiddenState,
} from '@/components/empresa/empty-empresa-state'

export const dynamic = 'force-dynamic'

export default async function RelatoriosGlobalPage() {
  const access = await resolveEmpresaAccess()
  if (access.kind === 'no-empresa-selected') return <NoEmpresaSelectedState />
  if (access.kind === 'no-access') return <NoAccessState />
  if (access.kind === 'forbidden')
    return <ForbiddenState permission={access.missingPermission} />

  redirect(`/empresas/${access.empresaId}/relatorios`)
}
