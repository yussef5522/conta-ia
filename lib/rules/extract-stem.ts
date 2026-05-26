// Sprint 5.0.2.k — Extrai "stem" (núcleo identificador) de uma descrição
// de transação, removendo dados variáveis (CPF, CNPJ, datas, IDs, nomes).
//
// Usado pra agrupar transações similares e sugerir regras.
//
// Exemplos:
//   "RECEBIMENTO PIX-PIX_CRED 03955593088 João Vitor Soares"
//     → "RECEBIMENTO PIX-PIX_CRED"
//
//   "PAGAMENTO BOLETO BANRISUL 9847234"
//     → "PAGAMENTO BOLETO BANRISUL"
//
//   "TARIFA MENSALIDADE 12/2025"
//     → "TARIFA MENSALIDADE"

const STOPWORDS = new Set([
  'DE',
  'DA',
  'DO',
  'DAS',
  'DOS',
  'E',
  'EM',
  'NA',
  'NO',
  'PARA',
  'COM',
  'POR',
  'PRO',
])

/**
 * Quantas palavras significativas pegar no stem.
 * 3 é o sweet spot — pega "RECEBIMENTO PIX-PIX_CRED" + 1 contexto
 * sem ser específico demais.
 */
const STEM_WORD_LIMIT = 2

/**
 * Mínimo de chars pra considerar uma palavra "significativa".
 */
const MIN_WORD_LEN = 3

export function extractDescriptionStem(description: string | null): string {
  if (!description || typeof description !== 'string') return ''

  let s = description.toUpperCase()

  // 1. Remove CNPJ (14 dígitos com ou sem máscara)
  s = s.replace(/\d{2}[\.\-\/]?\d{3}[\.\-\/]?\d{3}[\.\-\/]?\d{4}[\.\-\/]?\d{2}/g, ' ')
  // 2. Remove CPF (11 dígitos)
  s = s.replace(/\d{3}[\.\-]?\d{3}[\.\-]?\d{3}[\.\-]?\d{2}/g, ' ')
  // 3. Remove datas DD/MM/YYYY ou DD-MM-YYYY (com YY ou YYYY)
  s = s.replace(/\d{2}[\/\-]\d{2}[\/\-]\d{2,4}/g, ' ')
  // 4. Remove sequências de 6+ dígitos (IDs/códigos)
  s = s.replace(/\d{6,}/g, ' ')
  // 5. Remove valores monetários R$ X.YYY,ZZ (formato BR completo)
  s = s.replace(/R\$\s*[\d\.]+(?:[,\.]\d{1,2})?/g, ' ')
  // 5b. Remove decimais ",56" / ".99" deixados após remoção parcial
  s = s.replace(/[,\.]\d{1,2}\b/g, ' ')

  // 6. Tokeniza: trata separadores e mantém underscores/hífens INTERNOS pra
  //    preservar tokens como "PIX-PIX_CRED" (forma assinatura única do canal).
  //    Mas separa por espaços e barras.
  const tokens = s
    .split(/[\s\/]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= MIN_WORD_LEN)
    .filter((t) => !STOPWORDS.has(t))
    .filter((t) => !/^\d+$/.test(t)) // remove números puros

  // 7. Pega as N primeiras palavras significativas (ordem importa)
  const stem = tokens.slice(0, STEM_WORD_LIMIT).join(' ').trim()
  return stem
}

/**
 * Helper: pega o stem mais "longo" (mais específico) entre 2 descrições.
 * Útil pra escolher o melhor pattern quando temos várias variações.
 */
export function longestCommonStem(descriptions: string[]): string {
  if (descriptions.length === 0) return ''
  const stems = descriptions.map(extractDescriptionStem)
  // Stem mais frequente vence
  const counts = new Map<string, number>()
  for (const s of stems) {
    if (!s) continue
    counts.set(s, (counts.get(s) ?? 0) + 1)
  }
  let best = ''
  let bestCount = 0
  for (const [s, c] of counts) {
    if (c > bestCount || (c === bestCount && s.length > best.length)) {
      best = s
      bestCount = c
    }
  }
  return best
}
