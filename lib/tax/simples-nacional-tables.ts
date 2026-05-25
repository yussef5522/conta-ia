// Sprint 5.0.1 — Tabelas Simples Nacional 2026.
//
// FONTE: Lei Complementar 123/2006 (Estatuto da Microempresa e EPP)
// + Resoluções CGSN vigentes 2026.
//
// ⚠️ AVISO LEGAL: estes valores são fornecidos pra cálculo ESTIMADO. Sistema
// não substitui orientação contábil profissional. Verifique tabelas vigentes
// em https://www.gov.br/receitafederal antes de ações fiscais.
//
// Estrutura: cada anexo tem 6 faixas, cada faixa tem:
//   - rbaMin / rbaMax (Receita Bruta Acumulada 12m em R$)
//   - aliquota (alíquota nominal em %, ex: 6.0 = 6%)
//   - deduzir (parcela a deduzir em R$, da fórmula:
//       AliquotaEfetiva = ((RBA × AliquotaNominal) - Deduzir) / RBA)

export type SimplesAnexo = 'ANEXO_I' | 'ANEXO_II' | 'ANEXO_III' | 'ANEXO_IV' | 'ANEXO_V'

export interface SimplesFaixa {
  faixa: number
  rbaMin: number
  rbaMax: number
  aliquota: number
  deduzir: number
}

export const SIMPLES_LIMITE_RBA_2026 = 4_800_000 // teto Simples Nacional R$ 4,8M
export const SIMPLES_SUBLIMITE_ICMS = 3_600_000 // sublimite estadual ICMS
export const FATOR_R_THRESHOLD = 0.28 // 28% — corta entre Anexo III e V

const FAIXAS_COMERCIO: SimplesFaixa[] = [
  { faixa: 1, rbaMin: 0,         rbaMax: 180_000,    aliquota: 4.00,  deduzir: 0 },
  { faixa: 2, rbaMin: 180_000,   rbaMax: 360_000,    aliquota: 7.30,  deduzir: 5_940 },
  { faixa: 3, rbaMin: 360_000,   rbaMax: 720_000,    aliquota: 9.50,  deduzir: 13_860 },
  { faixa: 4, rbaMin: 720_000,   rbaMax: 1_800_000,  aliquota: 10.70, deduzir: 22_500 },
  { faixa: 5, rbaMin: 1_800_000, rbaMax: 3_600_000,  aliquota: 14.30, deduzir: 87_300 },
  { faixa: 6, rbaMin: 3_600_000, rbaMax: 4_800_000,  aliquota: 19.00, deduzir: 378_000 },
]

const FAIXAS_INDUSTRIA: SimplesFaixa[] = [
  { faixa: 1, rbaMin: 0,         rbaMax: 180_000,    aliquota: 4.50,  deduzir: 0 },
  { faixa: 2, rbaMin: 180_000,   rbaMax: 360_000,    aliquota: 7.80,  deduzir: 5_940 },
  { faixa: 3, rbaMin: 360_000,   rbaMax: 720_000,    aliquota: 10.00, deduzir: 13_860 },
  { faixa: 4, rbaMin: 720_000,   rbaMax: 1_800_000,  aliquota: 11.20, deduzir: 22_500 },
  { faixa: 5, rbaMin: 1_800_000, rbaMax: 3_600_000,  aliquota: 14.70, deduzir: 85_500 },
  { faixa: 6, rbaMin: 3_600_000, rbaMax: 4_800_000,  aliquota: 30.00, deduzir: 720_000 },
]

const FAIXAS_SERVICOS_III: SimplesFaixa[] = [
  { faixa: 1, rbaMin: 0,         rbaMax: 180_000,    aliquota: 6.00,  deduzir: 0 },
  { faixa: 2, rbaMin: 180_000,   rbaMax: 360_000,    aliquota: 11.20, deduzir: 9_360 },
  { faixa: 3, rbaMin: 360_000,   rbaMax: 720_000,    aliquota: 13.50, deduzir: 17_640 },
  { faixa: 4, rbaMin: 720_000,   rbaMax: 1_800_000,  aliquota: 16.00, deduzir: 35_640 },
  { faixa: 5, rbaMin: 1_800_000, rbaMax: 3_600_000,  aliquota: 21.00, deduzir: 125_640 },
  { faixa: 6, rbaMin: 3_600_000, rbaMax: 4_800_000,  aliquota: 33.00, deduzir: 648_000 },
]

const FAIXAS_CONSTRUCAO: SimplesFaixa[] = [
  { faixa: 1, rbaMin: 0,         rbaMax: 180_000,    aliquota: 4.50,  deduzir: 0 },
  { faixa: 2, rbaMin: 180_000,   rbaMax: 360_000,    aliquota: 9.00,  deduzir: 8_100 },
  { faixa: 3, rbaMin: 360_000,   rbaMax: 720_000,    aliquota: 10.20, deduzir: 12_420 },
  { faixa: 4, rbaMin: 720_000,   rbaMax: 1_800_000,  aliquota: 14.00, deduzir: 39_780 },
  { faixa: 5, rbaMin: 1_800_000, rbaMax: 3_600_000,  aliquota: 22.00, deduzir: 183_780 },
  { faixa: 6, rbaMin: 3_600_000, rbaMax: 4_800_000,  aliquota: 33.00, deduzir: 828_000 },
]

const FAIXAS_SERVICOS_V: SimplesFaixa[] = [
  { faixa: 1, rbaMin: 0,         rbaMax: 180_000,    aliquota: 15.50, deduzir: 0 },
  { faixa: 2, rbaMin: 180_000,   rbaMax: 360_000,    aliquota: 18.00, deduzir: 4_500 },
  { faixa: 3, rbaMin: 360_000,   rbaMax: 720_000,    aliquota: 19.50, deduzir: 9_900 },
  { faixa: 4, rbaMin: 720_000,   rbaMax: 1_800_000,  aliquota: 20.50, deduzir: 17_100 },
  { faixa: 5, rbaMin: 1_800_000, rbaMax: 3_600_000,  aliquota: 23.00, deduzir: 62_100 },
  { faixa: 6, rbaMin: 3_600_000, rbaMax: 4_800_000,  aliquota: 30.50, deduzir: 540_000 },
]

export const SIMPLES_TABLES: Record<SimplesAnexo, SimplesFaixa[]> = {
  ANEXO_I: FAIXAS_COMERCIO,
  ANEXO_II: FAIXAS_INDUSTRIA,
  ANEXO_III: FAIXAS_SERVICOS_III,
  ANEXO_IV: FAIXAS_CONSTRUCAO,
  ANEXO_V: FAIXAS_SERVICOS_V,
}

export const SIMPLES_ANEXO_LABELS: Record<SimplesAnexo, string> = {
  ANEXO_I: 'Anexo I — Comércio',
  ANEXO_II: 'Anexo II — Indústria',
  ANEXO_III: 'Anexo III — Serviços (com Fator R)',
  ANEXO_IV: 'Anexo IV — Construção / Vigilância / Limpeza',
  ANEXO_V: 'Anexo V — Serviços (sem Fator R)',
}

/**
 * Identifica a faixa baseada no RBA acumulado (12m).
 * Retorna null se RBA > teto Simples Nacional (R$ 4,8M).
 */
export function findFaixa(anexo: SimplesAnexo, rba: number): SimplesFaixa | null {
  if (rba < 0) return null
  if (rba > SIMPLES_LIMITE_RBA_2026) return null
  const tabela = SIMPLES_TABLES[anexo]
  // Faixa em que rba ≤ rbaMax (intervalos sem sobreposição: cobertura [rbaMin, rbaMax])
  for (const f of tabela) {
    if (rba <= f.rbaMax) return f
  }
  return null
}
