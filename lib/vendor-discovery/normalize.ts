// Sprint 5.0.2.n — Normalização de nome de vendor pra busca fuzzy no cache.

/**
 * UPPERCASE + remove acentos + colapsa whitespace. Mantém hífens internos.
 * Usado pra `vendorNameNormalized` no GlobalVendorKnowledge.
 */
export function normalizeVendorName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^\w\s\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
