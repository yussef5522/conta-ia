// Sprint 5.0.2.k+l — Extrai "stem" (núcleo identificador) de uma descrição
// de transação, removendo dados variáveis.
//
// Estratégia (Sprint 5.0.2.l — fix):
//   Cortar a descrição no PRIMEIRO bloco de 6+ dígitos consecutivos
//   (CPF/CNPJ/IDs longos). Tudo antes = estrutural; tudo depois = específico
//   (nome próprio do remetente/destinatário, número de boleto, etc).
//
// Exemplos:
//   "RECEBIMENTO PIX-PIX_CRED 86284304072 MURILLO CARDOSO"
//     → corta em "86284304072" → "RECEBIMENTO PIX-PIX_CRED"
//   "RECEBIMENTO PIX-PIX_CRE 83915761087 CRISTIAN"
//     → "RECEBIMENTO PIX-PIX_CRE" (bug do banco truncar D preservado)
//   "PAGAMENTO BOLETO BANRISUL 9847234"
//     → corta em "9847234" → "PAGAMENTO BOLETO BANRISUL"
//   "TARIFA MENSALIDADE 12/2025" (sem número 6+)
//     → fallback regex datas/valores → "TARIFA MENSALIDADE"

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
 * 3 com o corte no primeiro número 6+ é seguro — não pega nome próprio
 * porque o nome vem APÓS o CPF/CNPJ.
 */
const STEM_WORD_LIMIT = 3

/**
 * Mínimo de chars pra considerar uma palavra "significativa".
 */
const MIN_WORD_LEN = 3

export function extractDescriptionStem(description: string | null): string {
  if (!description || typeof description !== 'string') return ''

  let s = description.toUpperCase()

  // 1. Limpa identificadores FORMATADOS antes do corte (não são números
  //    consecutivos puros, então não seriam pegos pelo \d{6,}):
  //    CNPJ "12.345.678/0001-90", CPF "123.456.789-00", datas "DD/MM/YYYY".
  s = s.replace(/\d{2}\.\d{3}\.\d{3}\/\d{4}-?\d{2}/g, ' ') // CNPJ formatado
  s = s.replace(/\d{3}\.\d{3}\.\d{3}-?\d{2}/g, ' ') // CPF formatado
  s = s.replace(/\d{2}[\/\-]\d{2}[\/\-]\d{2,4}/g, ' ') // data
  s = s.replace(/R\$\s*[\d\.]+(?:[,\.]\d{1,2})?/g, ' ') // valor R$
  s = s.replace(/[,\.]\d{1,2}\b/g, ' ') // decimais

  // 2. Corte CHAVE (Sprint 5.0.2.l): se ainda há bloco de 6+ dígitos
  //    consecutivos (CPF 11, CNPJ 14, IDs longos não-formatados), tudo
  //    ANTES é o stem útil. Tudo DEPOIS (nome próprio, sufixos variáveis)
  //    é descartado.
  const firstNumber = s.match(/\d{6,}/)
  if (firstNumber && typeof firstNumber.index === 'number') {
    s = s.substring(0, firstNumber.index).trim()
  }

  // 3. Tokeniza preservando hífens/underscores internos (PIX-PIX_CRED = 1 token).
  const tokens = s
    .split(/[\s\/]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= MIN_WORD_LEN)
    .filter((t) => !STOPWORDS.has(t))
    .filter((t) => !/^\d+$/.test(t)) // só números

  return tokens.slice(0, STEM_WORD_LIMIT).join(' ').trim()
}

/**
 * Helper: stem mais frequente entre várias descrições.
 */
export function longestCommonStem(descriptions: string[]): string {
  if (descriptions.length === 0) return ''
  const stems = descriptions.map(extractDescriptionStem)
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
