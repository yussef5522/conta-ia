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

// ⭐⭐ PONTO ENTRE LETRAS VIRA ESPAÇO (28/08/2026) — o Banrisul ALTERNA a grafia.
//
// ⚠️ O CASO REAL: a mesma rubrica aparece como "OP. CREDITO C/GARANTIA" (24×, com espaço)
// e "OP.CREDITO C/GARANTIA" (30×, sem) — **no MESMO arquivo**: dias 25-27/08 com espaço,
// dia 28/08 sem. A regra aprendida casava uma e ignorava a outra, e o dono chegou a criar
// uma SEGUNDA regra na mão ("OP CREDITO C/GARANTIA", 0 aplicações) tentando cobrir a
// variante — sintoma clássico de match frágil.
//
// O que se remove é o ESPAÇO DEPOIS do ponto — o ponto FICA:
//     "OP. CREDITO"  →  "op.credito"        "OP.CREDITO"  →  "op.credito"   (casam)
//
// ⚠️ ESTREITEI DE PROPÓSITO. A 1ª tentativa trocava o ponto POR espaço, o que colapsava
// também "OP CREDITO" (sem ponto) — mas QUEBROU o detector de keyword do cartão:
// "Apple.Com/Bill" virava "apple com/bill" e a regra que procura "apple.com" parava de
// casar. O teste pegou. As duas grafias REAIS do banco diferem só pelo espaço, então
// remover o espaço resolve o caso sem tocar em domínio.
//
// ⚠️ Só entre LETRAS: não toca em decimal ("1.234,56"). E não afeta identidade de linha —
// o dedup do import usa `normalizeMemo` (`lib/reconciliation/normalize.ts`); aqui é só
// casamento de REGRA.
const PONTO_ENTRE_LETRAS = /(?<=\p{L})\.\s+(?=\p{L})/gu

export function normalizeDescription(raw: string): string {
  if (!raw) return ''

  let s = raw

  // 1. Strip prefixo nome próprio (apenas o PRIMEIRO " - ")
  s = s.replace(PREFIX_NAME_REGEX, '')

  // 2. Strip sufixo de data
  s = s.replace(DATE_SUFFIX_REGEX, '')

  // 3. Lowercase + remove acentos
  s = s.toLowerCase().normalize('NFD').replace(DIACRITICS_REGEX, '')

  // 3b. Tira o espaço depois do ponto (o banco alterna "OP. CREDITO"/"OP.CREDITO")
  s = s.replace(PONTO_ENTRE_LETRAS, '.')

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
    .replace(PONTO_ENTRE_LETRAS, '.') // "OP. CREDITO" == "OP.CREDITO"
    .replace(/\s+/g, ' ')
    .trim()
}
