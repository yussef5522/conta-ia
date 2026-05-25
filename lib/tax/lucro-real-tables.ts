// Sprint 5.0.2 — Tabelas Lucro Real 2026.
//
// FONTES:
// - Lei 9.430/1996 (IRPJ + adicional)
// - Lei 7.689/1988 (CSLL)
// - Lei 10.637/2002 (PIS não-cumulativo 1.65%)
// - Lei 10.833/2003 (COFINS não-cumulativo 7.6%)
// - LC 87/1996 (ICMS) — alíquotas internas conforme RICMS de cada estado
// - LC 116/2003 (ISS) — alíquota padrão 5% (varia por município)
//
// ⚠️ AVISO LEGAL: estimativa pra orientação. Lucro Real exige escrituração
// contábil completa + créditos PIS/COFINS específicos — consulte contador.

export const REAL_ALIQUOTAS = {
  IRPJ: 0.15, // 15% sobre lucro real
  IRPJ_ADICIONAL: 0.10, // 10% sobre excedente
  IRPJ_ADICIONAL_LIMITE_MENSAL: 20_000, // R$ 20k/mês (R$ 60k/trim na lei)
  CSLL: 0.09, // 9% sobre lucro real
  PIS: 0.0165, // 1,65% não-cumulativo
  COFINS: 0.076, // 7,6% não-cumulativo
} as const

// Alíquotas internas ICMS por UF (operações dentro do estado)
// Valores padrão; cada estado tem variações por produto/serviço.
export const ICMS_ESTADUAL_2026: Record<string, number> = {
  AC: 0.17, AL: 0.17, AM: 0.18, AP: 0.18, BA: 0.18,
  CE: 0.18, DF: 0.18, ES: 0.17, GO: 0.17, MA: 0.18,
  MG: 0.18, MS: 0.17, MT: 0.17, PA: 0.17, PB: 0.18,
  PE: 0.18, PI: 0.18, PR: 0.18, RJ: 0.18, RN: 0.18,
  RO: 0.17, RR: 0.17, RS: 0.17, SC: 0.17, SE: 0.18,
  SP: 0.18, TO: 0.18,
}

// ISS padrão (varia por município, 2-5%)
export const ISS_PADRAO_2026 = 0.05 // 5%

export const UF_LABELS: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AM: 'Amazonas', AP: 'Amapá', BA: 'Bahia',
  CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás',
  MA: 'Maranhão', MG: 'Minas Gerais', MS: 'Mato Grosso do Sul',
  MT: 'Mato Grosso', PA: 'Pará', PB: 'Paraíba', PE: 'Pernambuco',
  PI: 'Piauí', PR: 'Paraná', RJ: 'Rio de Janeiro',
  RN: 'Rio Grande do Norte', RO: 'Rondônia', RR: 'Roraima',
  RS: 'Rio Grande do Sul', SC: 'Santa Catarina', SE: 'Sergipe',
  SP: 'São Paulo', TO: 'Tocantins',
}

export function getICMSAliquota(uf: string | null | undefined): number {
  if (!uf) return 0.18 // fallback conservador (média BR)
  return ICMS_ESTADUAL_2026[uf.toUpperCase()] ?? 0.18
}
