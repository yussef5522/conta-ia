// Normalização de descrição pra Engine de Aprendizado — Fase 3 Etapa 1.
//
// Pipeline (validado empiricamente com 650 transações reais da Cacula Mix):
//   1. Strip prefixo "<Nome Próprio> - " (até o PRIMEIRO " - ")
//   2. Strip sufixos de data ("12/05", "/2026", "MAR/2026", etc)
//   3. Lowercase
//   4. Remove acentos (NFD + diacríticos)
//   5. Colapsa múltiplos espaços / trim
//
// Preserva separadores semânticos | e / (intencional — "pix | maquininha"
// deve ficar distinto de "pix enviado").
//
// Função PURA: testável sem DB, determinística.

// "^.*? - " = match não-greedy do prefixo ATÉ o primeiro " - " (inclusive).
// Cobre 48% das pendentes da Cacula Mix (311/650 com nome próprio variável).
const PREFIX_NAME_REGEX = /^.*? - /

// Sufixos de data comuns em OFX brasileiro:
//   " 12/05", " 05/2026", " MAR/2026", " 12/05/2026"
// Aplicado APÓS strip prefix.
const DATE_SUFFIX_REGEX =
  /\s+(\d{1,2}\/\d{1,2}(\/\d{2,4})?|\d{1,2}\/\d{4}|[a-z]{3}\/\d{2,4})\s*$/i

// Combining Diacritical Marks (U+0300 a U+036F) — acentos após NFD decompose.
const DIACRITICS_REGEX = /[̀-ͯ]/g

export function normalizeDescription(raw: string): string {
  if (!raw) return ''

  let s = raw

  // 1. Strip prefixo nome próprio (apenas o PRIMEIRO " - ")
  s = s.replace(PREFIX_NAME_REGEX, '')

  // 2. Strip sufixo de data
  s = s.replace(DATE_SUFFIX_REGEX, '')

  // 3. Lowercase + remove acentos
  s = s.toLowerCase().normalize('NFD').replace(DIACRITICS_REGEX, '')

  // 4. Colapsa múltiplos espaços + trim
  s = s.replace(/\s+/g, ' ').trim()

  return s
}

// Para match EXACT: lower + trim + remove acentos, MAS preserva descrição
// original (sem strip prefix). Usado quando a regra foi criada como "EXACT"
// e queremos casar descrição literal idêntica (case-insensitive).
export function normalizeExact(raw: string): string {
  if (!raw) return ''
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITICS_REGEX, '')
    .replace(/\s+/g, ' ')
    .trim()
}
