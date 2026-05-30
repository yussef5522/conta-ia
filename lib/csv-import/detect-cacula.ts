// Sprint CSV Import (30/05/2026) — Detector do header exato CACULA.
//
// Fast-path: se o header bate EXATAMENTE com o formato CACULA conhecido,
// usamos mapping determinístico (skip IA). Qualquer variação cai no fluxo
// genérico de detecção via IA (mesmo do Excel).
//
// Conservador POR DESIGN: exige os 20 campos EXATOS, NA ORDEM, sem
// variação além de case/whitespace + trailing "" (porque o CSV CACULA
// tem ; final que vira 21º campo vazio).
//
// Conformidade com decisão Yussef:
//   "O mapeamento determinístico tem que ser EXATAMENTE o do adendo"
//   → fast-path SÓ ativa se temos certeza absoluta do formato.

export const CACULA_HEADERS = [
  'ID',
  'VALOR',
  'JUROS/MULTA',
  'DESCONTO',
  'TOTAL',
  'PARCELA',
  'DATA LANCAMENTO',
  'DATA COMPETENCIA',
  'DATA DE VENCIMENTO',
  'DATA DO PAGAMENTO',
  'UNIDADE',
  'ORIGEM',
  'STATUS',
  'CREDOR/PAGANTE',
  'CATEGORIA CONTABIL',
  'DESCRICAO',
  'FORMA DE PAGAMENTO',
  'NUMERO NOTA',
  'BANCO',
  'OBS.',
] as const

export type CaculaHeader = (typeof CACULA_HEADERS)[number]

/** Índices das colunas CACULA pra acesso rápido no mapper. */
export const CACULA_INDICES = {
  ID: 0,
  VALOR: 1,
  JUROS_MULTA: 2,
  DESCONTO: 3,
  TOTAL: 4,
  PARCELA: 5,
  DATA_LANCAMENTO: 6,
  DATA_COMPETENCIA: 7,
  DATA_DE_VENCIMENTO: 8,
  DATA_DO_PAGAMENTO: 9,
  UNIDADE: 10,
  ORIGEM: 11,
  STATUS: 12,
  CREDOR_PAGANTE: 13,
  CATEGORIA_CONTABIL: 14,
  DESCRICAO: 15,
  FORMA_DE_PAGAMENTO: 16,
  NUMERO_NOTA: 17,
  BANCO: 18,
  OBS: 19,
} as const

/**
 * Retorna true se o array de headers bate com o formato CACULA exato.
 *
 * Tolera:
 *  - Case-insensitive
 *  - Whitespace extra (trim)
 *  - Trailing "" (CSV CACULA tem ; final → 21º campo vazio)
 *
 * NÃO tolera:
 *  - Ordem diferente
 *  - Colunas a mais (não vazias) ou a menos
 *  - Nomes ligeiramente diferentes ("OBS" vs "OBS.")
 */
export function isCaculaHeader(headers: readonly string[]): boolean {
  // Remove trailing "" repetidos (CSV CACULA tem ; final)
  const cleaned = [...headers]
  while (cleaned.length > 0 && (cleaned[cleaned.length - 1] ?? '').trim() === '') {
    cleaned.pop()
  }

  if (cleaned.length !== CACULA_HEADERS.length) return false

  for (let i = 0; i < CACULA_HEADERS.length; i++) {
    const got = (cleaned[i] ?? '').trim().toUpperCase()
    const want = CACULA_HEADERS[i].toUpperCase()
    if (got !== want) return false
  }
  return true
}
