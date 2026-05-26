// Sprint 5.0.2.m — Extração de "anchor word" (palavra identificadora) da
// descrição bancária. Usado pra criar regra silenciosa de auto-categorização
// quando o usuário classifica manualmente.
//
// Estratégia (5 passos, na ordem):
//   1. UPPERCASE + trim
//   2. Remove prefixos comuns (PAG, PIX, TED, RECEBIMENTO, etc.)
//   3. Remove ruídos: números longos (CPF/CNPJ/IDs), datas DD/MM, valores R$,
//      sufixos "REF 123", "NF 47", etc.
//   4. Tokeniza preservando hífens internos
//   5. Retorna o primeiro token "significativo" (≥4 chars, não-stopword,
//      não-numérico). Vendors BR conhecidos curtos (SPAL, BRF, JBS) entram
//      na lista permitida explicitamente.
//
// Exemplos esperados:
//   "PAG TECOPONTO SOLUÇÕES NF 47" → "TECOPONTO"
//   "PAGAMENTO SPAL DISTRIBUIDORA 12/2025" → "SPAL"
//   "PAG AMBEV S.A. REF 11" → "AMBEV"
//   "PAGAMENTO STONE D+1" → "STONE"

/**
 * Vendors BR conhecidos com 3-5 chars que devem ser aceitos como anchor
 * mesmo abaixo do limite mínimo padrão de 4. Curated.
 */
const KNOWN_BR_VENDORS_SHORT = new Set([
  'SPAL',
  'AMBEV',
  'COCA',
  'BRF',
  'JBS',
  'STONE',
  'CIELO',
  'REDE',
  'CELESC',
  'CASAN',
  'VIVO',
  'TIM',
  'CLARO',
  'OI',
  'IFOOD',
  'UBER',
  '99',
  'RAPPI',
  'CPFL',
  'ENEL',
  'CEMIG',
  'COPEL',
  'COPASA',
  'CEDAE',
  'COMGAS',
  'SHELL',
  'BBH',
  'SEARA',
  'BRF',
  'PACT',
  'W12',
])

/**
 * Prefixos típicos que NÃO identificam o fornecedor — descartados pelo
 * pré-processamento. Ordem: do mais longo pro mais curto (evita comer
 * substring errada).
 */
const PREFIXES_TO_STRIP: ReadonlyArray<string> = [
  'PAGAMENTO BOLETO',
  'PAGAMENTO TITULO',
  'PAGAMENTO',
  'RECEBIMENTO',
  'CRED CARD',
  'CREDITO',
  'CRED ',
  'DEBITO',
  'DEB ',
  'TRANSF',
  'COMPRA',
  'PAG ',
  'PIX ',
  'TED ',
  'DOC ',
]

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
  // Sufixos jurídicos
  'LTDA',
  'ME',
  'EIRELI',
  'SA',
  'S/A',
  'EPP',
  'CIA',
  // Marcadores fiscais
  'NF',
  'REF',
  'NF-E',
  'NFE',
  'NFSE',
  // Genéricos
  'CRED',
  'DEB',
  'DEBT',
  // Verbos/fillers Pix (não identificam fornecedor)
  'RECEBIDO',
  'ENVIADO',
  'REMETIDO',
  'EFETUADO',
  'TRANSFERENCIA',
])

const MIN_WORD_LEN = 4

export function extractAnchorWord(description: string | null | undefined): string | null {
  if (!description) return null

  let s = description.toUpperCase().trim()

  // 1. Strip prefixos (apenas no início)
  for (const prefix of PREFIXES_TO_STRIP) {
    if (s.startsWith(prefix)) {
      s = s.substring(prefix.length).trim()
      break // só 1 prefixo
    }
  }

  // 2. Limpa identificadores formatados ANTES de remover dígitos consecutivos
  //    (caso CNPJ "12.345.678/0001-90" não tem 6 dígitos consecutivos)
  s = s.replace(/\d{2}\.\d{3}\.\d{3}\/\d{4}-?\d{2}/g, ' ')
  s = s.replace(/\d{3}\.\d{3}\.\d{3}-?\d{2}/g, ' ')

  // 3. Remove números longos (≥6 dígitos = CPF/CNPJ não formatado, IDs)
  s = s.replace(/\d{6,}/g, ' ')

  // 4. Remove datas DD/MM/YYYY ou DD-MM-YY
  s = s.replace(/\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}/g, ' ')
  // Mes/ano isolado (12/2025)
  s = s.replace(/\d{1,2}\/\d{4}/g, ' ')

  // 5. Remove valores monetários
  s = s.replace(/R\$\s*[\d.,]+/g, ' ')
  // Decimais soltos ",56"
  s = s.replace(/[,\.]\d{1,2}\b/g, ' ')

  // 6. Remove sufixos "REF 123", "NF 47"
  s = s.replace(/\bREF\s*\d+/gi, ' ')
  s = s.replace(/\bNF\s*\d+/gi, ' ')

  // 7. Remove pontuação restante (mas preserva hífen interno PIX-CRED)
  s = s.replace(/[.,;:!?()[\]{}'"]/g, ' ')

  // 8. Tokeniza
  const tokens = s
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t) => !STOPWORDS.has(t))
    .filter((t) => !/^\d+$/.test(t)) // descarta puramente numéricos

  // 9. Acha o primeiro token significativo
  for (const t of tokens) {
    if (t.length >= MIN_WORD_LEN) return t
    if (KNOWN_BR_VENDORS_SHORT.has(t)) return t // curto mas conhecido
  }

  return null
}

/**
 * Exposto pra testes — checa se uma palavra está na lista de short vendors.
 */
export function isKnownShortVendor(word: string): boolean {
  return KNOWN_BR_VENDORS_SHORT.has(word.toUpperCase())
}
