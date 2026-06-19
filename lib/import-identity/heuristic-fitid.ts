// Sprint Import Idempotente (18/06/2026) — heurística de confiabilidade do FITID.
//
// OFX define FITID como "Financial Institution Transaction ID" e deveria
// ser único e estável entre exports. Na prática:
//   - Stone: UUID v4 ("989220bb-...") ✓ CONFIÁVEL — estável e único
//   - Sicredi: numérico longo ("22313501711") ✓ CONFIÁVEL
//   - Banrisul: numérico CURTO sequencial ("000001", "702998") ✗ REUSA
//     entre transações distintas, MUDA em re-export
//
// Decisão (Sprint 30/04/2026 fix Banrisul): dedup interno por
// `dedupHash(fitid + data + valor + memo)`. PORÉM se o fitid for sequencial
// curto, ele "polui" o hash — 2 transações ESTRUTURALMENTE IDÊNTICAS num
// re-export do Banrisul podem ter o mesmo fitid renumerado e BATEM o hash
// (proteção corre OK). Mas se o cliente re-importa e os fitids vêm
// renumerados (ex: import de OFX que pulou linhas), o hash quebra.
//
// Solução desta sprint: separar em DOIS níveis de identidade:
//   - `fitidKey`  (sha256 accountId + FITID) — só pra FITIDs CONFIÁVEIS;
//      gate por igualdade exata.
//   - `contentHash` (sha256 accountId + data + valorCentavos + descNormalizada)
//      — sempre presente; gate por COUNT (suporta tx legitimamente idênticas).
//
// Pra FITIDs não confiáveis, fitidKey = null. Dedup só por contentHash.

/**
 * Decide se o FITID é confiável o suficiente pra usar como gate exato.
 *
 * Critérios CONFIÁVEL:
 *   1. UUID v4 (36 chars com hífens, formato canônico)
 *   2. Numérico com >= 10 dígitos (Sicredi típico)
 *   3. Alfanumérico longo (>= 12 chars) com letra (Pluggy IDs, etc)
 *
 * Critérios NÃO confiáveis:
 *   - String <= 6 dígitos (Banrisul "000001")
 *   - Numérico sequencial curto (<= 9 dígitos)
 *   - Vazio / null
 */
export function isFitidConfiavel(fitid: string | null | undefined): boolean {
  if (!fitid) return false
  const trimmed = fitid.trim()
  if (trimmed.length === 0) return false

  // UUID v4 / v1 / qualquer canonical
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    return true
  }

  // Numérico longo (Sicredi, Caixa, etc) — 10+ dígitos
  if (/^\d{10,}$/.test(trimmed)) {
    return true
  }

  // Alfanumérico longo com pelo menos 1 letra (Pluggy, gateways)
  if (trimmed.length >= 12 && /[a-z]/i.test(trimmed) && /^[a-z0-9_-]+$/i.test(trimmed)) {
    return true
  }

  // Tudo o resto: curto, sequencial, suspeito
  return false
}

/**
 * Diagnóstico humano legível: por que esse FITID é/não é confiável.
 */
export function describeFitid(fitid: string | null | undefined): string {
  if (!fitid || fitid.trim().length === 0) return 'fitid vazio'
  const t = fitid.trim()
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t)) {
    return 'UUID canônico — confiável'
  }
  if (/^\d{10,}$/.test(t)) {
    return `numérico ${t.length} dígitos — confiável`
  }
  if (t.length >= 12 && /[a-z]/i.test(t)) {
    return `alfanumérico ${t.length} chars — confiável`
  }
  if (/^\d+$/.test(t)) {
    return `numérico curto (${t.length} dígitos) — banco renumera, NÃO confiável`
  }
  return `formato suspeito (${t.length} chars) — NÃO confiável`
}
