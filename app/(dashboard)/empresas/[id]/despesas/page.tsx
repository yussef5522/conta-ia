// Sprint 6 — Página de Despesas (drill-down do Top 5).
//
// FONTE ÚNICA: lê do mesmo motor do Sprint 4 via getExpenseBreakdown
// (lib/dashboard/expenses-breakdown). Total da página BATE com
// despesaOperacional do dashboard ao centavo.

import type { Metadata } from 'next'
import { resolveEmpresaAccess } from '@/lib/auth/resolve-empresa-access'
import {
  NoEmpresaSelectedState,
  NoAccessState,
} from '@/components/empresa/empty-empresa-state'
import { prisma } from '@/lib/db'
import { getExpenseBreakdown } from '@/lib/dashboard/expenses-breakdown'
import { derivePeriods } from '@/lib/dashboard/period'
import type { Regime } from '@/lib/dashboard/engine'
import { DespesasClient } from './despesas-client'

export const metadata: Metadata = { title: 'Despesas' }
export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{
    regime?: string
    de?: string
    ate?: string
    cat?: string
    contaId?: string
    q?: string
  }>
}

export default async function DespesasPage({ params, searchParams }: PageProps) {
  const { id: paramEmpresaId } = await params
  const sp = await searchParams

  const access = await resolveEmpresaAccess()
  if (access.kind === 'no-empresa-selected') return <NoEmpresaSelectedState />
  if (access.kind === 'no-access') return <NoAccessState />
  if (access.kind === 'forbidden') return <NoAccessState />

  const empresaId = paramEmpresaId || access.empresaId

  const empresa = await prisma.company.findUnique({
    where: { id: empresaId },
    select: { id: true, name: true, tradeName: true },
  })
  if (!empresa) return <NoAccessState />

  // Regime caixa default
  const regime: Regime = sp.regime === 'competencia' ? 'competencia' : 'caixa'

  // Período: usa mês corrente como default; usuário pode trocar via UI
  const refDate = new Date()
  const periods = derivePeriods(refDate)
  const periodStart = sp.de ? new Date(`${sp.de}T00:00:00.000Z`) : periods.currentMonth.start
  const periodEnd = sp.ate ? new Date(`${sp.ate}T23:59:59.999Z`) : periods.currentMonth.end

  // Breakdown (server-side; cache 60s tag dashboard:${empresaId})
  const breakdown = await getExpenseBreakdown({
    companyId: empresaId,
    periodStart,
    periodEnd,
    regime,
  })

  // Contas pra filtro
  const contas = await prisma.bankAccount.findMany({
    where: { companyId: empresaId, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  // Sprint 10 — todas as categorias da empresa (pro CategoryPicker inline/lote)
  const categorias = await prisma.category.findMany({
    where: { companyId: empresaId, isActive: true },
    select: {
      id: true,
      name: true,
      type: true,
      dreGroup: true,
      color: true,
    },
    orderBy: { name: 'asc' },
  })

  return (
    <DespesasClient
      empresaId={empresaId}
      empresaNome={empresa.tradeName ?? empresa.name}
      breakdown={breakdown}
      contas={contas}
      categorias={categorias}
      regime={regime}
      periodStart={periodStart.toISOString().slice(0, 10)}
      periodEnd={periodEnd.toISOString().slice(0, 10)}
      initialExpandedCategoryId={sp.cat ?? null}
      initialContaId={sp.contaId ?? null}
      initialQuery={sp.q ?? ''}
    />
  )
}
