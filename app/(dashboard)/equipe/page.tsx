// ⭐⭐ EQUIPE — a tela única de gente (06/09/2026). Mesmo padrão de /usuarios: lê a empresa
// do cookie e exige a chave que já existe (`user.invite`).

import type { Metadata } from 'next'
import { EquipeClient } from '@/components/equipe/equipe-client'
import { resolveEmpresaAccess } from '@/lib/auth/resolve-empresa-access'
import {
  NoEmpresaSelectedState,
  NoAccessState,
  ForbiddenState,
} from '@/components/empresa/empty-empresa-state'

export const metadata: Metadata = { title: 'Equipe' }

interface PageProps { searchParams: Promise<{ filtro?: string }> }

export default async function EquipePage({ searchParams }: PageProps) {
  const access = await resolveEmpresaAccess({ requirePermission: 'user.invite' })
  if (access.kind === 'no-empresa-selected') return <NoEmpresaSelectedState />
  if (access.kind === 'no-access') return <NoAccessState />
  if (access.kind === 'forbidden') return <ForbiddenState permission={access.missingPermission} />
  const sp = await searchParams

  return (
    <EquipeClient
      empresaId={access.empresaId}
      empresaNome={access.empresa.tradeName ?? access.empresa.name}
      filtro={sp.filtro === 'cozinha' ? 'cozinha' : undefined}
    />
  )
}
