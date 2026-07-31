// Sprint Fix Dedup Import (30/07/2026) — identidade de LINHA pra a coluna dedupHash.
//
// PROBLEMA (BUG A): stableKey é chave de MATCHING — colide DE PROPÓSITO quando 2
// transações reais são idênticas em data+valor+memo (ex: 2 "TARIFA PIX COMPRA" de
// mesmo valor no mesmo dia, comuns no Banrisul). Esse stableKey estava sendo
// gravado direto em `dedupHash`, coluna com @@unique([bankAccountId, dedupHash]).
// Resultado: 2 transações reais idênticas → mesmo stableKey → P2002 → erro cru.
//
// FIX: separar os papéis. `dedupHash` vira IDENTIDADE DE LINHA:
//   stableKey + '#' + batchId + ':' + ocorrência
// - `batchId` (id único do OfxImport, ou token único do confirm) namespaceia o lote.
// - `occ` distingue linhas idênticas DENTRO do mesmo lote (0, 1, 2, ...).
// Garantias:
//   - N linhas idênticas → N dedupHash distintos → N linhas no banco. NADA descartado.
//   - @@unique continua satisfeita SEM tocar a constraint (reserva de transfer V1 intacta).
//   - stableKey PERMANECE sem fitid: re-import / dedup é feito pelo reconcileStatement,
//     que RECOMPUTA o stableKey das colunas (date/amount/memo) e nunca lê esta coluna.
//   - Namespace por batchId ⇒ nunca colide com linhas de outros imports, nem com o
//     sha256 do V1, nem com stableKey "puro" de linhas antigas ⇒ sem backfill.
//
// ⚠️ NUNCA use este valor pra MATCHING/dedup — é per-linha de propósito.
//    Matching = stableKey (./stable-key) + reconcileStatement (./reconcile-statement).

export function buildLineDedupHash(
  stableKeyValue: string,
  batchId: string,
  occ: number,
): string {
  return `${stableKeyValue}#${batchId}:${occ}`
}

/**
 * Contador de ocorrência por stableKey dentro de UM lote de criação.
 * Primeira linha de um stableKey → 0, segunda idêntica → 1, etc.
 */
export function makeOccurrenceCounter(): (stableKeyValue: string) => number {
  const seen = new Map<string, number>()
  return (stableKeyValue: string): number => {
    const n = seen.get(stableKeyValue) ?? 0
    seen.set(stableKeyValue, n + 1)
    return n
  }
}
