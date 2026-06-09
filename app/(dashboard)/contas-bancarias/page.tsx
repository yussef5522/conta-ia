// Sprint Unificar-Contas (08/06/2026) — /contas-bancarias foi unificada em
// /empresas/[id]/contas. Esta página agora só faz redirect (server-side).
//
// Histórico: era a tela legada agrupada por empresa (sidebar legado já
// removido). Quase ninguém chegava aqui — só 2 empty states em /transacoes
// apontavam pra cá, e foram atualizados nesta mesma sprint.

import { redirect } from 'next/navigation'
import { resolveEmpresaAccess } from '@/lib/auth/resolve-empresa-access'

export const dynamic = 'force-dynamic'

export default async function ContasBancariasRedirectPage() {
  const access = await resolveEmpresaAccess()
  if (access.kind === 'no-empresa-selected') {
    redirect('/empresas')
  }
  if (access.kind === 'no-access' || access.kind === 'forbidden') {
    redirect('/empresas')
  }
  redirect(`/empresas/${access.empresaId}/contas`)
}
