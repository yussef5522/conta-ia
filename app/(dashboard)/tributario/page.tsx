// Sprint 5.0.2.c.2 — Hub Tributário (TurboTax/QuickBooks pattern).
// 1 entrada sidebar → 4 tabs internas.

import type { Metadata } from 'next'
import { Suspense } from 'react'
import { prisma } from '@/lib/db'
import { resolveEmpresaAccess } from '@/lib/auth/resolve-empresa-access'
import {
  NoEmpresaSelectedState,
  NoAccessState,
} from '@/components/empresa/empty-empresa-state'
import { DisclaimerInfo } from '@/components/tax/disclaimer-info'
import { Header } from '@/components/layout/header'
import { TaxHub } from '@/components/tributario/tax-hub'
import { VisaoTab } from '@/components/tributario/tabs/visao-tab'
import { HistoricoTab } from '@/components/tributario/tabs/historico-tab'

export const metadata: Metadata = { title: 'Tributário' }
export const dynamic = 'force-dynamic'

export default async function TributarioPage() {
  const access = await resolveEmpresaAccess()
  if (access.kind === 'no-empresa-selected') return <NoEmpresaSelectedState />
  if (access.kind === 'no-access') return <NoAccessState />
  if (access.kind === 'forbidden') return <NoAccessState />

  const [profile, lastCalc, calcs] = await Promise.all([
    prisma.companyTaxProfile.findUnique({ where: { companyId: access.empresaId } }),
    prisma.taxCalculation.findFirst({
      where: { companyId: access.empresaId },
      orderBy: [{ paYear: 'desc' }, { paMonth: 'desc' }],
    }),
    prisma.taxCalculation.findMany({
      where: { companyId: access.empresaId },
      orderBy: [{ paYear: 'desc' }, { paMonth: 'desc' }],
      take: 60,
    }),
  ])

  return (
    <div className="space-y-6">
      <Header
        title="Tributário"
        description={`Visão fiscal — ${access.empresa.tradeName ?? access.empresa.name}`}
      >
        <DisclaimerInfo />
      </Header>

      <Suspense fallback={null}>
        <TaxHub
          visao={<VisaoTab empresaId={access.empresaId} profile={profile} lastCalc={lastCalc} />}
          historico={<HistoricoTab calcs={calcs} />}
        />
      </Suspense>
    </div>
  )
}
