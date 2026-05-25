// Sprint 5.0.2 — Comparação dos 3 regimes + recomendação.
//
// Função PURA. Recebe inputs, calcula todos os regimes elegíveis, retorna
// ranking + recomendação contextualizada com economia anual estimada.
//
// ⚠️ Recomendação é orientativa. Mudança real de regime exige análise contábil
// + projeção anual + considerar outros fatores (folha, créditos, etc).

import {
  calculateSimples,
  type SimplesCalculationResult,
} from './simples-engine'
import {
  SIMPLES_LIMITE_RBA_2026,
  type SimplesAnexo,
} from './simples-nacional-tables'
import {
  calculatePresumido,
  PRESUMIDO_LIMITE_RBA_2026,
  type PresumidoCalculationResult,
} from './presumido-engine'
import type { AtividadePresumido } from './lucro-presumido-tables'
import { calculateReal, type RealCalculationResult } from './real-engine'

export type RegimeKey = 'SIMPLES_NACIONAL' | 'LUCRO_PRESUMIDO' | 'LUCRO_REAL'

export interface ComparisonInput {
  receitaBrutaMes: number
  rbaAcumulada: number
  folha12m: number
  // Pra Simples (opcional — pode ser null se user nem pretende Simples)
  anexoSimples?: SimplesAnexo | null
  // Pra Presumido
  atividade: AtividadePresumido
  // Pra Real
  margemRealPercent: number
  // Comum (Presumido + Real)
  estado?: string | null
  hasICMS: boolean
  hasISS: boolean
  creditosPIS?: number
  creditosCOFINS?: number
}

export interface RegimeRow {
  regime: RegimeKey
  aplicavel: boolean
  motivoNaoAplicavel?: string
  total: number
  aliquotaEfetiva: number
  totalAnual: number // = total × 12 (estimativa)
  detalhes?:
    | SimplesCalculationResult
    | PresumidoCalculationResult
    | RealCalculationResult
}

export interface ComparisonResult {
  simples: RegimeRow
  presumido: RegimeRow
  real: RegimeRow
  recomendacao: {
    regime: RegimeKey
    economiaMensal: number
    economiaAnual: number
    economiaVsPiorRegimePercent: number
    justificativa: string
  } | null
}

function row(opts: Partial<RegimeRow> & { regime: RegimeKey }): RegimeRow {
  return {
    aplicavel: false,
    total: 0,
    aliquotaEfetiva: 0,
    totalAnual: 0,
    ...opts,
  }
}

export function compareRegimes(input: ComparisonInput): ComparisonResult {
  // 1. Simples
  let simplesRow: RegimeRow
  if (!input.anexoSimples) {
    simplesRow = row({
      regime: 'SIMPLES_NACIONAL',
      aplicavel: false,
      motivoNaoAplicavel: 'Anexo do Simples não informado',
    })
  } else if (input.rbaAcumulada + input.receitaBrutaMes > SIMPLES_LIMITE_RBA_2026) {
    simplesRow = row({
      regime: 'SIMPLES_NACIONAL',
      aplicavel: false,
      motivoNaoAplicavel: `Faturamento R$ ${(input.rbaAcumulada + input.receitaBrutaMes).toLocaleString('pt-BR')} excede teto Simples (R$ 4,8M)`,
    })
  } else {
    const det = calculateSimples({
      anexo: input.anexoSimples,
      receitaBrutaMes: input.receitaBrutaMes,
      rbaAcumulada: input.rbaAcumulada,
      folha12m: input.folha12m,
    })
    simplesRow = {
      regime: 'SIMPLES_NACIONAL',
      aplicavel: true,
      total: det.dasValue,
      aliquotaEfetiva: det.aliquotaEfetiva ?? 0,
      totalAnual: det.dasValue * 12,
      detalhes: det,
    }
  }

  // 2. Presumido
  let presumidoRow: RegimeRow
  if (input.rbaAcumulada + input.receitaBrutaMes > PRESUMIDO_LIMITE_RBA_2026) {
    presumidoRow = row({
      regime: 'LUCRO_PRESUMIDO',
      aplicavel: false,
      motivoNaoAplicavel: `Faturamento excede limite Lucro Presumido (R$ 78M)`,
    })
  } else {
    const det = calculatePresumido({
      atividade: input.atividade,
      receitaBrutaMes: input.receitaBrutaMes,
      rbaAcumulada: input.rbaAcumulada,
      estado: input.estado,
      hasICMS: input.hasICMS,
      hasISS: input.hasISS,
    })
    presumidoRow = {
      regime: 'LUCRO_PRESUMIDO',
      aplicavel: true,
      total: det.total,
      aliquotaEfetiva: det.aliquotaEfetiva,
      totalAnual: det.total * 12,
      detalhes: det,
    }
  }

  // 3. Real (sempre aplicável)
  const realDet = calculateReal({
    receitaBrutaMes: input.receitaBrutaMes,
    margemRealPercent: input.margemRealPercent,
    estado: input.estado,
    hasICMS: input.hasICMS,
    hasISS: input.hasISS,
    creditosPIS: input.creditosPIS,
    creditosCOFINS: input.creditosCOFINS,
  })
  const realRow: RegimeRow = {
    regime: 'LUCRO_REAL',
    aplicavel: true,
    total: realDet.total,
    aliquotaEfetiva: realDet.aliquotaEfetiva,
    totalAnual: realDet.total * 12,
    detalhes: realDet,
  }

  // 4. Recomendação
  const candidatos = [simplesRow, presumidoRow, realRow].filter((r) => r.aplicavel)
  if (candidatos.length === 0) {
    return { simples: simplesRow, presumido: presumidoRow, real: realRow, recomendacao: null }
  }

  const melhor = candidatos.reduce((a, b) => (a.total < b.total ? a : b))
  const pior = candidatos.reduce((a, b) => (a.total > b.total ? a : b))
  const economiaMensal = Math.round((pior.total - melhor.total) * 100) / 100
  const economiaAnual = Math.round((pior.totalAnual - melhor.totalAnual) * 100) / 100
  const economiaPercent =
    pior.total > 0 ? Math.round(((pior.total - melhor.total) / pior.total) * 100) : 0

  const regimeLabel: Record<RegimeKey, string> = {
    SIMPLES_NACIONAL: 'Simples Nacional',
    LUCRO_PRESUMIDO: 'Lucro Presumido',
    LUCRO_REAL: 'Lucro Real',
  }

  const justificativa =
    economiaMensal > 0
      ? `${regimeLabel[melhor.regime]} economiza R$ ${economiaMensal.toLocaleString('pt-BR')}/mês (R$ ${economiaAnual.toLocaleString('pt-BR')}/ano, ${economiaPercent}% menos imposto) comparado a ${regimeLabel[pior.regime]}.`
      : `${regimeLabel[melhor.regime]} apresenta o menor encargo nesta análise.`

  return {
    simples: simplesRow,
    presumido: presumidoRow,
    real: realRow,
    recomendacao: {
      regime: melhor.regime,
      economiaMensal,
      economiaAnual,
      economiaVsPiorRegimePercent: economiaPercent,
      justificativa,
    },
  }
}
