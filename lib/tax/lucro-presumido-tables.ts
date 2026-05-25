// Sprint 5.0.2 — Tabelas Lucro Presumido 2026.
//
// FONTES:
// - Lei 9.249/1995 art. 15 (margens IRPJ)
// - Lei 9.430/1996 art. 20 (margens CSLL)
// - Lei 9.430/1996 (IRPJ adicional 10% > R$ 60k/trimestre, equiv R$ 20k/mês)
// - Lei 12.814/2013 (limite R$ 78M anuais — atualizado pela LC 187/2021)
// - Lei 10.637/2002 + Lei 10.833/2003 (PIS/COFINS cumulativo)
//
// ⚠️ AVISO LEGAL: estimativa baseada em legislação vigente 2026.
// Confirme com seu contador antes de optar por regime ou pagar tributos.

export type AtividadePresumido =
  | 'COMERCIO'
  | 'INDUSTRIA'
  | 'SERVICOS'
  | 'SERVICOS_HOSPITALARES'
  | 'TRANSPORTE_CARGAS'
  | 'TRANSPORTE_PASSAGEIROS'
  | 'REVENDA_COMBUSTIVEIS'
  | 'CONSTRUCAO_CIVIL'

export interface PresuncaoMargem {
  atividade: AtividadePresumido
  label: string
  // % do faturamento que vira base de cálculo IRPJ (Lei 9.249/95 art. 15)
  margemIRPJ: number
  // % do faturamento que vira base de cálculo CSLL (Lei 9.430/96 art. 20)
  margemCSLL: number
}

export const MARGENS_PRESUNCAO_2026: PresuncaoMargem[] = [
  { atividade: 'COMERCIO', label: 'Comércio em geral', margemIRPJ: 8.0, margemCSLL: 12.0 },
  { atividade: 'INDUSTRIA', label: 'Indústria', margemIRPJ: 8.0, margemCSLL: 12.0 },
  { atividade: 'SERVICOS', label: 'Serviços em geral', margemIRPJ: 32.0, margemCSLL: 32.0 },
  {
    atividade: 'SERVICOS_HOSPITALARES',
    label: 'Serviços hospitalares',
    margemIRPJ: 8.0,
    margemCSLL: 12.0,
  },
  {
    atividade: 'TRANSPORTE_CARGAS',
    label: 'Transporte de cargas',
    margemIRPJ: 8.0,
    margemCSLL: 12.0,
  },
  {
    atividade: 'TRANSPORTE_PASSAGEIROS',
    label: 'Transporte de passageiros',
    margemIRPJ: 16.0,
    margemCSLL: 12.0,
  },
  {
    atividade: 'REVENDA_COMBUSTIVEIS',
    label: 'Revenda de combustíveis',
    margemIRPJ: 1.6,
    margemCSLL: 12.0,
  },
  {
    atividade: 'CONSTRUCAO_CIVIL',
    label: 'Construção civil',
    margemIRPJ: 8.0,
    margemCSLL: 12.0,
  },
]

export function findMargemPresuncao(
  atividade: AtividadePresumido,
): PresuncaoMargem | null {
  return MARGENS_PRESUNCAO_2026.find((m) => m.atividade === atividade) ?? null
}

// Alíquotas Lucro Presumido (Lei 9.249/95 + Leis 10.637/02 e 10.833/03)
export const PRESUMIDO_ALIQUOTAS = {
  IRPJ: 0.15, // 15% sobre base presumida
  IRPJ_ADICIONAL: 0.10, // 10% sobre excedente
  // Limite mensal da base presumida pra IRPJ adicional.
  // Lei real apura trimestralmente (R$ 60k/trim); aqui simplificamos
  // pra mensal (R$ 20k/mês). Documentado como aproximação MVP.
  IRPJ_ADICIONAL_LIMITE_MENSAL: 20_000,
  CSLL: 0.09, // 9% sobre base presumida
  PIS: 0.0065, // 0,65% cumulativo sobre receita bruta
  COFINS: 0.03, // 3% cumulativo sobre receita bruta
} as const

// Limite anual Lucro Presumido (Lei 12.814/2013 + LC 187/2021)
export const PRESUMIDO_LIMITE_RBA_2026 = 78_000_000 // R$ 78 milhões
