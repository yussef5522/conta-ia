// Sprint 5.0.2 — Engine PURO de cálculo Lucro Presumido.
//
// Fórmula:
//   BaseIRPJ  = receita × margemIRPJ
//   BaseCSLL  = receita × margemCSLL
//   IRPJ      = BaseIRPJ × 15%
//   Adicional = max(0, BaseIRPJ − 20.000) × 10%   (limite mensal)
//   CSLL      = BaseCSLL × 9%
//   PIS       = receita × 0,65%
//   COFINS    = receita × 3%
//   ICMS      = receita × aliq_estado  (se hasICMS)
//   ISS       = receita × 5%           (se hasISS)
//   Total     = soma
//   AliqEf    = Total / receita × 100

import {
  MARGENS_PRESUNCAO_2026,
  PRESUMIDO_ALIQUOTAS,
  PRESUMIDO_LIMITE_RBA_2026,
  type AtividadePresumido,
  findMargemPresuncao,
} from './lucro-presumido-tables'
import { getICMSAliquota, ISS_PADRAO_2026 } from './lucro-real-tables'

export interface PresumidoCalculationInput {
  atividade: AtividadePresumido
  receitaBrutaMes: number
  rbaAcumulada?: number // pra alertar se estourou limite anual
  estado?: string | null
  hasICMS: boolean
  hasISS: boolean
}

export interface PresumidoCalculationResult {
  receitaBruta: number
  atividade: AtividadePresumido
  baseIRPJ: number
  baseCSLL: number
  irpj: number
  irpjAdicional: number
  csll: number
  pis: number
  cofins: number
  icms: number
  iss: number
  total: number
  aliquotaEfetiva: number
  breakdown: Record<string, number>
  warnings: string[]
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function calculatePresumido(
  input: PresumidoCalculationInput,
): PresumidoCalculationResult {
  if (input.receitaBrutaMes < 0) throw new Error('receita não pode ser negativa')

  const margem = findMargemPresuncao(input.atividade)
  if (!margem) {
    throw new Error(`Atividade inválida pra Lucro Presumido: ${input.atividade}`)
  }

  const warnings: string[] = []
  if (input.rbaAcumulada != null && input.rbaAcumulada > PRESUMIDO_LIMITE_RBA_2026) {
    warnings.push(
      `RBA R$ ${input.rbaAcumulada.toLocaleString('pt-BR')} excede limite Lucro Presumido (R$ ${PRESUMIDO_LIMITE_RBA_2026.toLocaleString('pt-BR')}). Empresa deve migrar pra Lucro Real.`,
    )
  }

  const baseIRPJ = round2(input.receitaBrutaMes * (margem.margemIRPJ / 100))
  const baseCSLL = round2(input.receitaBrutaMes * (margem.margemCSLL / 100))

  const irpj = round2(baseIRPJ * PRESUMIDO_ALIQUOTAS.IRPJ)
  const excedente = Math.max(
    0,
    baseIRPJ - PRESUMIDO_ALIQUOTAS.IRPJ_ADICIONAL_LIMITE_MENSAL,
  )
  const irpjAdicional = round2(excedente * PRESUMIDO_ALIQUOTAS.IRPJ_ADICIONAL)

  const csll = round2(baseCSLL * PRESUMIDO_ALIQUOTAS.CSLL)
  const pis = round2(input.receitaBrutaMes * PRESUMIDO_ALIQUOTAS.PIS)
  const cofins = round2(input.receitaBrutaMes * PRESUMIDO_ALIQUOTAS.COFINS)

  const icms = input.hasICMS
    ? round2(input.receitaBrutaMes * getICMSAliquota(input.estado))
    : 0
  const iss = input.hasISS ? round2(input.receitaBrutaMes * ISS_PADRAO_2026) : 0

  const total = round2(irpj + irpjAdicional + csll + pis + cofins + icms + iss)
  const aliquotaEfetiva =
    input.receitaBrutaMes > 0 ? round2((total / input.receitaBrutaMes) * 100) : 0

  return {
    receitaBruta: input.receitaBrutaMes,
    atividade: input.atividade,
    baseIRPJ,
    baseCSLL,
    irpj,
    irpjAdicional,
    csll,
    pis,
    cofins,
    icms,
    iss,
    total,
    aliquotaEfetiva,
    breakdown: { irpj, irpjAdicional, csll, pis, cofins, icms, iss },
    warnings,
  }
}

export { MARGENS_PRESUNCAO_2026, PRESUMIDO_LIMITE_RBA_2026 }
