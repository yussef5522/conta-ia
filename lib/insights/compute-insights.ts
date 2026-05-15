// Orquestrador puro dos detectors — Sprint 2 Dia 3.
// Roda todos os detectors registrados + ordena por severity → priority desc.

import type { Detector, Insight, InsightContext } from './types'
import { detectPendingClassifications } from './detectors/pending-classifications'
import { detectHighOverdraftUsage } from './detectors/high-overdraft-usage'
import { detectBurnRateSpike } from './detectors/burn-rate-spike'

const DETECTORS: Detector[] = [
  detectPendingClassifications,
  detectHighOverdraftUsage,
  detectBurnRateSpike,
]

// Ordem semântica de severity: alerta > oportunidade > sugestao > parabens.
// Dentro da mesma severity, priority desc (10 > 1).
const SEVERITY_ORDER: Record<Insight['severity'], number> = {
  alerta: 0,
  oportunidade: 1,
  sugestao: 2,
  parabens: 3,
}

export function computeInsights(ctx: InsightContext): Insight[] {
  if (!ctx.companyId) {
    throw new Error('companyId é obrigatório (isolamento multi-tenant)')
  }

  const all: Insight[] = []
  for (const detector of DETECTORS) {
    all.push(...detector(ctx))
  }

  return all.sort((a, b) => {
    const s = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
    if (s !== 0) return s
    return b.priority - a.priority
  })
}

// Export pros testes — permite verificar que todos os 3 detectors do Dia 3
// estão registrados.
export const REGISTERED_DETECTORS = DETECTORS
