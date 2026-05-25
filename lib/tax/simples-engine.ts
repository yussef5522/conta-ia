// Sprint 5.0.1 — Engine PURO de cálculo DAS Simples Nacional.
//
// Função sem dependências externas. Recebe inputs em number JS, retorna
// outputs em number JS arredondados a 2 decimais (centavos).
//
// Fórmula oficial (LC 123/2006):
//
//   AliquotaEfetiva = ((RBA12m × AliquotaNominal) - Deduzir) / RBA12m
//   DAS = ReceitaBrutaMes × AliquotaEfetiva
//
// Fator R (decide entre Anexo III e Anexo V quando aplicável):
//
//   FatorR = Folha12m / RBA12m
//   Se FatorR ≥ 28% → usa Anexo III (alíquota menor, com folha)
//   Se FatorR < 28% → usa Anexo V (alíquota maior, sem folha)
//
// ⚠️ DISCLAIMER: cálculos são ESTIMATIVAS. Não substitui orientação contábil.

import {
  type SimplesAnexo,
  findFaixa,
  SIMPLES_LIMITE_RBA_2026,
  FATOR_R_THRESHOLD,
} from './simples-nacional-tables'

export interface SimplesCalculationInput {
  // Anexo desejado (input do user / perfil tributário)
  anexo: SimplesAnexo
  // Receita Bruta do mês de competência (em R$)
  receitaBrutaMes: number
  // Receita Bruta Acumulada últimos 12m (em R$). NÃO inclui o mês corrente.
  rbaAcumulada: number
  // Folha últimos 12m (pra cálculo Fator R)
  folha12m: number
}

export interface SimplesCalculationResult {
  // Anexo efetivamente usado (pode diferir do input se Fator R inverteu III↔V)
  anexoUsado: SimplesAnexo
  anexoOriginal: SimplesAnexo
  fatorR: number
  fatorRApplied: boolean

  // Faixa identificada (1-6)
  faixa: number | null
  aliquotaNominal: number | null // %, ex: 6.00
  parcelaDeduzir: number | null // R$
  aliquotaEfetiva: number | null // %, calculada pela fórmula

  // Valor DAS (R$, 2 decimais)
  dasValue: number

  // Breakdown opcional pro futuro split IRPJ/CSLL/PIS/COFINS/CPP/ICMS/ISS.
  // Sprint 5.0.1 retorna só dasValue total; split fino fica pra 5.0.2.
  breakdown: Record<string, number>

  // Avisos: limites excedidos, Fator R inverteu anexo, RBA zero, etc.
  warnings: string[]
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000
}

/**
 * Aplica regra do Fator R: decide qual anexo usar entre III e V.
 *
 * IMPORTANTE: o Fator R só altera entre Anexo III ↔ Anexo V.
 *   - Anexo I (Comércio) → não muda
 *   - Anexo II (Indústria) → não muda
 *   - Anexo IV (Construção) → não muda
 *   - Anexo III input + Fator R < 28% → muda pra V
 *   - Anexo V input + Fator R ≥ 28% → muda pra III
 */
function resolveAnexoWithFatorR(
  inputAnexo: SimplesAnexo,
  fatorR: number,
): { anexo: SimplesAnexo; applied: boolean } {
  if (inputAnexo !== 'ANEXO_III' && inputAnexo !== 'ANEXO_V') {
    return { anexo: inputAnexo, applied: false }
  }
  if (inputAnexo === 'ANEXO_III' && fatorR < FATOR_R_THRESHOLD) {
    return { anexo: 'ANEXO_V', applied: true }
  }
  if (inputAnexo === 'ANEXO_V' && fatorR >= FATOR_R_THRESHOLD) {
    return { anexo: 'ANEXO_III', applied: true }
  }
  return { anexo: inputAnexo, applied: false }
}

export function calculateSimples(input: SimplesCalculationInput): SimplesCalculationResult {
  const warnings: string[] = []

  // Validações de entrada
  if (input.receitaBrutaMes < 0) {
    throw new Error('receitaBrutaMes não pode ser negativa')
  }
  if (input.rbaAcumulada < 0) {
    throw new Error('rbaAcumulada não pode ser negativa')
  }
  if (input.folha12m < 0) {
    throw new Error('folha12m não pode ser negativa')
  }

  // Fator R (proteção contra divisão por zero)
  const fatorR =
    input.rbaAcumulada > 0 ? round4(input.folha12m / input.rbaAcumulada) : 0

  // Resolve anexo com Fator R (só impacta III↔V)
  const { anexo: anexoUsado, applied: fatorRApplied } = resolveAnexoWithFatorR(
    input.anexo,
    fatorR,
  )
  if (fatorRApplied) {
    warnings.push(
      `Fator R = ${(fatorR * 100).toFixed(1)}% → anexo trocado de ${input.anexo} pra ${anexoUsado}`,
    )
  }

  // RBA pra projeção da alíquota efetiva inclui o mês corrente (regra SN)
  const rbaProjeto = input.rbaAcumulada + input.receitaBrutaMes

  // Aviso se estourou teto
  if (rbaProjeto > SIMPLES_LIMITE_RBA_2026) {
    warnings.push(
      `RBA projetada R$ ${rbaProjeto.toLocaleString('pt-BR')} excede teto Simples Nacional (R$ ${SIMPLES_LIMITE_RBA_2026.toLocaleString('pt-BR')}). Empresa pode ser desenquadrada.`,
    )
  }

  // Identifica faixa
  const faixa = findFaixa(anexoUsado, rbaProjeto)
  if (!faixa) {
    return {
      anexoUsado,
      anexoOriginal: input.anexo,
      fatorR,
      fatorRApplied,
      faixa: null,
      aliquotaNominal: null,
      parcelaDeduzir: null,
      aliquotaEfetiva: null,
      dasValue: 0,
      breakdown: {},
      warnings: [...warnings, 'RBA acima do teto — DAS não calculado'],
    }
  }

  // Fórmula oficial: AliqEfetiva = ((RBA × Aliq) - Deduzir) / RBA
  // RBA usada aqui é a acumulada 12m + mês corrente (RBA projeção)
  let aliquotaEfetiva = 0
  if (rbaProjeto > 0) {
    const aliquotaNominalDec = faixa.aliquota / 100
    aliquotaEfetiva =
      round4(((rbaProjeto * aliquotaNominalDec) - faixa.deduzir) / rbaProjeto) * 100
  }

  // DAS = receita do mês × alíquota efetiva
  const dasValue = round2(input.receitaBrutaMes * (aliquotaEfetiva / 100))

  return {
    anexoUsado,
    anexoOriginal: input.anexo,
    fatorR,
    fatorRApplied,
    faixa: faixa.faixa,
    aliquotaNominal: faixa.aliquota,
    parcelaDeduzir: faixa.deduzir,
    aliquotaEfetiva: round4(aliquotaEfetiva),
    dasValue,
    breakdown: { dasTotal: dasValue },
    warnings,
  }
}
