// Sprint A — Normalização de descrição PRA MATCH (não confundir com lib/ai-categorizer/normalize).
//
// O normalizer de categorização strippa prefixo "<nome> - " porque queremos
// agrupar transações independente do nome próprio (ex: "Yussef PIX - Boleto").
// Pra MATCH é o OPOSTO: queremos PRESERVAR o nome do fornecedor e remover
// apenas sufixos COMERCIAIS conhecidos.
//
// Exemplo crítico (caso real Cacula Mix, 03/06/2026):
//   OFX:   "NESTLE BRASIL LTDA - Pagamento"
//   Excel: "Nestle Brasil Ltda"
//   normalizeDescription (categoria): OFX → "pagamento", Excel → "nestle brasil ltda" → Jaro-Winkler ≈ 0.0
//   normalizeForMatch (este):         OFX → "nestle brasil ltda", Excel → "nestle brasil ltda" → 1.0
//
// Função PURA: testável sem DB.

const DIACRITICS_REGEX = /[̀-ͯ]/g

// Sufixos comerciais comuns em OFX/extrato BR que NÃO carregam identidade
// do fornecedor — só descrevem a OPERAÇÃO.
// Aplicado APÓS lowercase + acentos. Inclui variantes com e sem "- ".
const TRAILING_COMMERCIAL_SUFFIXES = [
  // Variantes com "- " (padrão Itaú/Bradesco/Banrisul)
  '- pagamento',
  '- compra',
  '- recebimento',
  '- recebido',
  '- enviado',
  '- transferencia',
  '- ted',
  '- doc',
  '- pix recebido',
  '- pix enviado',
  '- pix',
  '- boleto',
  '- debito',
  '- credito',
  '- tef',
  // Variantes SEM "- " (padrão Sicredi/Caixa/Nubank)
  'pix recebido',
  'pix enviado',
  'pix',
  'pagamento',
  'pagto',
  'pgto',
  'boleto',
  'ted',
  'doc',
  'tef',
]

// Sufixos de data (mesmo pattern do normalizer de categoria, replicado aqui
// pra não acoplar — match precisa controle local)
const DATE_SUFFIX_REGEX =
  /\s+(\d{1,2}\/\d{1,2}(\/\d{2,4})?|\d{1,2}\/\d{4}|[a-z]{3}\/\d{2,4})\s*$/i

// Códigos numéricos comuns ("12345", IDs, FITID-like) no FINAL
const TRAILING_CODE_REGEX = /\s+\d{4,}\s*$/

// Pontuação que pode aparecer entre tokens: hífen com espaços, vírgula no fim
const PUNCT_CLEAN_REGEX = /[.,;:!?]+\s*$/

export function normalizeForMatch(raw: string): string {
  if (!raw) return ''

  let s = raw

  // 1. Lowercase + remove acentos
  s = s.toLowerCase().normalize('NFD').replace(DIACRITICS_REGEX, '')

  // 2. Loop iterativo de strip de sufixos.
  // Cada remoção pode expor outro sufixo "atrás" (ex: "... - pagamento 12/05 12345"
  // precisa strip código → expor data → strip data → expor "- pagamento").
  // Ordem dentro do loop: código → data → comerciais → pontuação.
  let changed = true
  while (changed) {
    changed = false
    const before = s

    // 2a. Strip código numérico terminal
    s = s.replace(TRAILING_CODE_REGEX, '')

    // 2b. Strip data terminal (DD/MM, DD/MM/YYYY, MMM/YYYY)
    s = s.replace(DATE_SUFFIX_REGEX, '')

    // 2c. Strip sufixos comerciais conhecidos
    const trimmed = s.trim()
    for (const suffix of TRAILING_COMMERCIAL_SUFFIXES) {
      if (trimmed.endsWith(suffix)) {
        s = trimmed.slice(0, -suffix.length).trim()
        break
      }
    }

    // 2d. Strip pontuação terminal
    s = s.replace(PUNCT_CLEAN_REGEX, '')

    if (s.trim() !== before.trim()) {
      changed = true
    }
    s = s.trim()
  }

  // 3. Colapsa múltiplos espaços
  s = s.replace(/\s+/g, ' ').trim()

  return s
}
