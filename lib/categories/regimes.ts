// Regimes tributários brasileiros suportados pelo Conta IA.
// Decisão de produto Yussef 03/05/2026: multi-regime nativo via filtro
// app-layer em Category.visibleInRegimes. SQLite/Postgres dual: JSON string
// ao invés de array nativo (compat com strategy "sed" do deploy).

export const REGIMES_TRIBUTARIOS = [
  'SIMPLES_NACIONAL_I',
  'SIMPLES_NACIONAL_II',
  'SIMPLES_NACIONAL_III',
  'SIMPLES_NACIONAL_IV',
  'SIMPLES_NACIONAL_V',
  'LUCRO_PRESUMIDO',
  'LUCRO_REAL',
  'MEI',
] as const

export type RegimeTributario = (typeof REGIMES_TRIBUTARIOS)[number]

// Helpers pra montar visibleInRegimes em templates de forma legível
export const REGIMES_SIMPLES: RegimeTributario[] = [
  'SIMPLES_NACIONAL_I',
  'SIMPLES_NACIONAL_II',
  'SIMPLES_NACIONAL_III',
  'SIMPLES_NACIONAL_IV',
  'SIMPLES_NACIONAL_V',
]

export const REGIMES_PRESUMIDO_REAL: RegimeTributario[] = [
  'LUCRO_PRESUMIDO',
  'LUCRO_REAL',
]

export const REGIMES_NAO_SIMPLES: RegimeTributario[] = [
  'LUCRO_PRESUMIDO',
  'LUCRO_REAL',
  'SIMPLES_NACIONAL_IV', // Anexo IV recolhe INSS Patronal à parte do DAS
]

export const ALL_REGIMES: RegimeTributario[] = [...REGIMES_TRIBUTARIOS]

// Decide se uma categoria deve aparecer pro regime atual da empresa.
// Contrato: visibleInRegimes null/inválido → visível em todos (failsafe).
export function categoriaVisivelNoRegime(
  cat: { visibleInRegimes: string | null },
  regime: RegimeTributario,
): boolean {
  if (!cat.visibleInRegimes) return true
  try {
    const arr = JSON.parse(cat.visibleInRegimes) as unknown
    if (!Array.isArray(arr)) return true
    return arr.includes(regime)
  } catch {
    return true
  }
}

// Helper pra serializar arrays nos templates de forma compacta
export function regimesToJson(regimes: RegimeTributario[] | null): string | null {
  if (!regimes || regimes.length === 0) return null
  return JSON.stringify(regimes)
}
