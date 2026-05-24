// Sprint 4.0.3 — Server component que carrega dados e renderiza Fluxo + Alertas lado a lado.

import { getFluxoPrevistoSnapshot } from '@/lib/dashboard/queries-previsto'
import { FluxoPrevistoCard } from './FluxoPrevistoCard'
import { AlertasVencimentoCard } from './AlertasVencimentoCard'

interface Props {
  companyId: string
}

export async function PrevistoSection({ companyId }: Props) {
  const snapshot = await getFluxoPrevistoSnapshot(companyId)

  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <FluxoPrevistoCard data={snapshot.fluxoPrevisto} />
      <AlertasVencimentoCard data={snapshot.alertas} companyId={companyId} />
    </div>
  )
}
