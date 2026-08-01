// Sprint Contraparte PIX (31/07/2026) — precedência ÚNICA de origem da contraparte.
//
// Regra: uma fonte só sobrescreve a contraparte já gravada se tiver precedência
// MAIOR OU IGUAL. Assim o nome definido MANUALMENTE pelo usuário NUNCA é
// sobrescrito por enriquecimento automático (OFX/PDF/Open Finance).
//
//   MANUAL  >  OPEN_FINANCE  >  OFX  >  PDF_STATEMENT
//
// ⚠️ LGPD: o valor associado (counterpartyName/Document) é dado pessoal de
//    terceiro. Esta função lida só com a ORIGEM (string curta), nunca com o nome.

export type CounterpartySource = 'MANUAL' | 'OPEN_FINANCE' | 'OFX' | 'PDF_STATEMENT'

const RANK: Record<CounterpartySource, number> = {
  MANUAL: 4,
  OPEN_FINANCE: 3,
  OFX: 2,
  PDF_STATEMENT: 1,
}

export function isCounterpartySource(v: unknown): v is CounterpartySource {
  return typeof v === 'string' && v in RANK
}

/**
 * A fonte `incoming` pode gravar por cima da `existing`?
 * - Sem valor existente (null/undefined/'') → sempre pode.
 * - Fonte existente desconhecida → tratada como sobrescrevível (dado legado).
 * - Caso normal → só se rank(incoming) >= rank(existing).
 *
 * MANUAL existente + incoming PDF_STATEMENT → false (protege o manual).
 * PDF_STATEMENT existente + incoming OFX → true (OFX ganha do PDF).
 */
export function canApplyCounterparty(
  existingSource: string | null | undefined,
  incoming: CounterpartySource,
): boolean {
  if (!existingSource) return true
  if (!isCounterpartySource(existingSource)) return true
  return RANK[incoming] >= RANK[existingSource]
}
