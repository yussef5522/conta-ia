// Sprint 5.0.2 — Engine PURO de cálculo Lucro Real (versão básica MVP).
//
// Diferenças vs Presumido:
//   - Base de cálculo IRPJ/CSLL = lucro REAL (declarado pelo cliente como % receita)
//   - PIS/COFINS NÃO-cumulativos (alíquotas maiores) com desconto de créditos
//
// ⚠️ Lucro Real exige escrituração contábil completa. Esse cálculo é estimativa
// pra orientação — créditos PIS/COFINS reais dependem de insumos específicos.

import { REAL_ALIQUOTAS, getICMSAliquota, ISS_PADRAO_2026 } from './lucro-real-tables'

export interface RealCalculationInput {
  receitaBrutaMes: number
  // Margem real declarada pelo cliente (% da receita que vira lucro tributável)
  margemRealPercent: number
  estado?: string | null
  hasICMS: boolean
  hasISS: boolean
  // Sprint 5.0.2.f — Compras do mês (insumos, embalagens, mercadorias, etc).
  // Quando informado, calcula CRÉDITOS PIS/COFINS automaticamente:
  //   creditoPIS = comprasMes × 1,65%
  //   creditoCOFINS = comprasMes × 7,6%
  // Lei 10.637/2002 art. 3º + Lei 10.833/2003 art. 3º.
  comprasMes?: number
  // Créditos PIS/COFINS em VALOR DIRETO (R$). Override do auto-cálculo via
  // comprasMes — pra casos avançados onde user já calculou o crédito real.
  creditosPIS?: number
  creditosCOFINS?: number
}

export interface RealCalculationResult {
  receitaBruta: number
  lucroReal: number
  irpj: number
  irpjAdicional: number
  csll: number
  pis: number
  pisBruto: number
  pisCreditos: number
  cofins: number
  cofinsBruto: number
  cofinsCreditos: number
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

export function calculateReal(input: RealCalculationInput): RealCalculationResult {
  if (input.receitaBrutaMes < 0) throw new Error('receita não pode ser negativa')
  if (input.margemRealPercent < 0 || input.margemRealPercent > 100) {
    throw new Error('margemRealPercent fora de range 0-100')
  }

  const warnings: string[] = []
  if (input.margemRealPercent === 15) {
    warnings.push(
      'Margem real default 15% — calibre no perfil pra refletir DRE real da empresa',
    )
  }

  const lucroReal = round2(input.receitaBrutaMes * (input.margemRealPercent / 100))

  const irpj = round2(lucroReal * REAL_ALIQUOTAS.IRPJ)
  const excedente = Math.max(0, lucroReal - REAL_ALIQUOTAS.IRPJ_ADICIONAL_LIMITE_MENSAL)
  const irpjAdicional = round2(excedente * REAL_ALIQUOTAS.IRPJ_ADICIONAL)

  const csll = round2(lucroReal * REAL_ALIQUOTAS.CSLL)

  // PIS/COFINS não-cumulativo com desconto de créditos.
  // Sprint 5.0.2.f — créditos AUTO de compras OU manuais em R$.
  const pisBruto = round2(input.receitaBrutaMes * REAL_ALIQUOTAS.PIS)
  const cofinsBruto = round2(input.receitaBrutaMes * REAL_ALIQUOTAS.COFINS)

  // Override em R$ tem prioridade; senão calcula de comprasMes
  const comprasMes = input.comprasMes ?? 0
  const pisCreditosAuto = round2(comprasMes * REAL_ALIQUOTAS.PIS)
  const cofinsCreditosAuto = round2(comprasMes * REAL_ALIQUOTAS.COFINS)

  const pisCreditos = round2(input.creditosPIS ?? pisCreditosAuto)
  const cofinsCreditos = round2(input.creditosCOFINS ?? cofinsCreditosAuto)
  const pis = round2(Math.max(0, pisBruto - pisCreditos))
  const cofins = round2(Math.max(0, cofinsBruto - cofinsCreditos))

  // Warning quando user não informa compras (Lucro Real sem créditos é
  // artificialmente caro — sinal claro pra UI mostrar)
  if (comprasMes === 0 && pisCreditos === 0 && cofinsCreditos === 0) {
    warnings.push(
      '⚠️ Sem compras informadas — créditos PIS/COFINS não-cumulativos NÃO aplicados (Lei 10.637/02 + 10.833/03). Lucro Real pode ficar mais barato ao informar custos.',
    )
  }

  const icms = input.hasICMS
    ? round2(input.receitaBrutaMes * getICMSAliquota(input.estado))
    : 0
  const iss = input.hasISS ? round2(input.receitaBrutaMes * ISS_PADRAO_2026) : 0

  const total = round2(irpj + irpjAdicional + csll + pis + cofins + icms + iss)
  const aliquotaEfetiva =
    input.receitaBrutaMes > 0 ? round2((total / input.receitaBrutaMes) * 100) : 0

  return {
    receitaBruta: input.receitaBrutaMes,
    lucroReal,
    irpj,
    irpjAdicional,
    csll,
    pis,
    pisBruto,
    pisCreditos,
    cofins,
    cofinsBruto,
    cofinsCreditos,
    icms,
    iss,
    total,
    aliquotaEfetiva,
    breakdown: { irpj, irpjAdicional, csll, pis, cofins, icms, iss },
    warnings,
  }
}
