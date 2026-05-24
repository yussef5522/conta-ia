// Sprint 4.0.5.b — Plano de Contas global. Lê empresa do cookie.

import type { Metadata } from 'next'
import { prisma } from '@/lib/db'
import { CategoriasClient } from '@/app/(dashboard)/empresas/[id]/categorias/categorias-client'
import { resolveEmpresaAccess } from '@/lib/auth/resolve-empresa-access'
import {
  NoEmpresaSelectedState,
  NoAccessState,
} from '@/components/empresa/empty-empresa-state'

export const metadata: Metadata = { title: 'Plano de Contas' }

const TIPO_LABELS: Record<string, string> = {
  service: 'Serviço',
  restaurant: 'Restaurante',
  retail: 'Comércio',
  industry: 'Indústria',
  clinica: 'Clínica',
  salao: 'Salão',
  mixed: 'Misto',
  other: 'Outro',
}

const REGIME_LABELS: Record<string, string> = {
  SIMPLES_NACIONAL_I: 'Simples Nacional — Anexo I',
  SIMPLES_NACIONAL_II: 'Simples Nacional — Anexo II',
  SIMPLES_NACIONAL_III: 'Simples Nacional — Anexo III',
  SIMPLES_NACIONAL_IV: 'Simples Nacional — Anexo IV',
  SIMPLES_NACIONAL_V: 'Simples Nacional — Anexo V',
  LUCRO_PRESUMIDO: 'Lucro Presumido',
  LUCRO_REAL: 'Lucro Real',
  MEI: 'MEI',
  SIMPLES_NACIONAL: 'Simples Nacional',
}

export default async function CategoriasPage() {
  const access = await resolveEmpresaAccess()
  if (access.kind === 'no-empresa-selected') return <NoEmpresaSelectedState />
  if (access.kind === 'no-access') return <NoAccessState />
  if (access.kind === 'forbidden') return <NoAccessState />

  // Carrega type + taxRegime extra (não vem do resolveEmpresaAccess)
  const meta = await prisma.company.findUnique({
    where: { id: access.empresaId },
    select: { type: true, taxRegime: true },
  })
  const totalCategorias = await prisma.category.count({
    where: { companyId: access.empresaId, isActive: true },
  })

  const setorLabel = TIPO_LABELS[(meta?.type ?? '').toLowerCase()] ?? meta?.type ?? '—'
  const regimeLabel = REGIME_LABELS[meta?.taxRegime ?? ''] ?? meta?.taxRegime ?? '—'

  return (
    <CategoriasClient
      empresaId={access.empresaId}
      empresaNome={access.empresa.tradeName ?? access.empresa.name}
      totalCategorias={totalCategorias}
      setorLabel={setorLabel}
      regimeLabel={regimeLabel}
    />
  )
}
