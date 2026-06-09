// Sprint Unificar-Contas (08/06/2026) — /bancos foi unificado em
// /empresas/[id]/contas (tela completa com bancos + Caixa + cheque
// especial + ajustar saldo + transferir + freshness OFX). Esta página
// agora só faz redirect (server-side) preservando empresaId quando
// presente no query string.
//
// História: a tela ANTIGA (/bancos) tinha freshness badge + botão
// Importar OFX direto, mas faltava CASH, edit, excluir, ajustar saldo.
// Os 2 melhores recursos foram migrados pra tela boa antes do redirect.

import { redirect } from 'next/navigation'
import { resolveEmpresaAccess } from '@/lib/auth/resolve-empresa-access'

export const dynamic = 'force-dynamic'

export default async function BancosRedirectPage() {
  const access = await resolveEmpresaAccess()
  if (access.kind === 'no-empresa-selected') {
    redirect('/empresas')
  }
  if (access.kind === 'no-access' || access.kind === 'forbidden') {
    redirect('/empresas')
  }
  redirect(`/empresas/${access.empresaId}/contas`)
}
