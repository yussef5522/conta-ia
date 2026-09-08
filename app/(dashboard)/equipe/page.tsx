// ⭐⭐ EQUIPE — a tela única de gente (06/09/2026). Mesmo padrão de /usuarios: lê a empresa
// do cookie e exige a chave que já existe (`user.invite`).

import type { Metadata } from 'next'
import { EquipeClient } from '@/components/equipe/equipe-client'
import { resolveEmpresaAccess } from '@/lib/auth/resolve-empresa-access'
import { permissionMatches } from '@/lib/auth/permissions'
import {
  NoEmpresaSelectedState,
  NoAccessState,
  ForbiddenState,
} from '@/components/empresa/empty-empresa-state'

export const metadata: Metadata = { title: 'Equipe' }

interface PageProps { searchParams: Promise<{ filtro?: string }> }

export default async function EquipePage({ searchParams }: PageProps) {
  // ⭐⭐ A PORTA ABRE PRAS DUAS METADES DA TELA (08/09/2026) — decisão do dono: *"Cristian e
  // Marcyelle passam a poder, na tela de Equipe: adicionar pessoa de COZINHA (nome + PIN),
  // TROCAR/redefinir o PIN de quem esqueceu, inativar/reativar colaborador de cozinha."*
  //
  // ⛔ Medido antes de mexer: as ROTAS dessas ações já exigem `stock.manage`, que o
  // GERENTE_ESTOQUE tem (`stock.*`) — e o convite/papel/aparelho já exigem `user.invite`,
  // que ele NÃO tem. **A fronteira do dono já estava de pé no servidor.** O que barrava era
  // só a porta: a página inteira exigia `user.invite`, então ele não abria a tela pra fazer
  // o que já podia.
  const access = await resolveEmpresaAccess({ requirePermission: ['user.invite', 'stock.manage'] })
  if (access.kind === 'no-empresa-selected') return <NoEmpresaSelectedState />
  if (access.kind === 'no-access') return <NoAccessState />
  if (access.kind === 'forbidden') return <ForbiddenState permission={access.missingPermission} />
  const sp = await searchParams

  return (
    <EquipeClient
      empresaId={access.empresaId}
      empresaNome={access.empresa.tradeName ?? access.empresa.name}
      filtro={sp.filtro === 'cozinha' ? 'cozinha' : undefined}
      /* ⛔ o que ele NÃO pode aparece DESABILITADO com o motivo, em vez de estourar no
         clique. O servidor recusa igual — as duas portas, sempre. */
      podeGerenciarAcessos={permissionMatches(access.permissions, 'user.invite')}
    />
  )
}
