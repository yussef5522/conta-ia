// Sprint CSV-Encoding: decodificador de bytes pra CSV com detecção de encoding.
//
// Excel BR salva CSV em Windows-1252 (ANSI) por padrão. Sistemas legados podem
// salvar em UTF-16 LE/BE. Sem detecção, `Buffer.toString('utf8')` corrompe
// acentos e quebra o mapping heurístico (header "Descrição" vira "Descri��o"
// → não casa contains "descricao").
//
// Estratégia:
//   1. BOM UTF-8 (EF BB BF) → utf-8
//   2. BOM UTF-16 LE (FF FE) → utf-16le
//   3. BOM UTF-16 BE (FE FF) → utf-16be
//   4. Sem BOM: tenta UTF-8 strict; se >1% replacement chars (U+FFFD) ou
//      contém bytes inválidos pra UTF-8 nos primeiros 4KB → re-decoda como
//      windows-1252 (dominante em CSV BR).

export type DetectedEncoding =
  | 'utf-8'
  | 'utf-16le'
  | 'utf-16be'
  | 'windows-1252'

export interface DecodedCsvBytes {
  encoding: DetectedEncoding
  /** Texto decodificado pronto pra parseCsv */
  text: string
  /** Quantos U+FFFD (replacement char) sobraram após decode */
  replacementCharsCount: number
  /** True se BOM foi detectado e usado pra escolher encoding */
  bomDetected: boolean
}

const BOM_UTF8 = [0xef, 0xbb, 0xbf]
const BOM_UTF16_LE = [0xff, 0xfe]
const BOM_UTF16_BE = [0xfe, 0xff]

function startsWith(bytes: Uint8Array, prefix: number[]): boolean {
  if (bytes.length < prefix.length) return false
  for (let i = 0; i < prefix.length; i++) {
    if (bytes[i] !== prefix[i]) return false
  }
  return true
}

function countReplacementChars(text: string): number {
  let n = 0
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 0xfffd) n++
  }
  return n
}

/**
 * Decoda bytes em texto, detectando encoding automaticamente. Decisão
 * conservadora: prefere UTF-8 quando válido; só cai pra Windows-1252 se UTF-8
 * estrito falha (>1% replacement chars na amostra inicial).
 */
export function decodeCsvBytes(
  input: ArrayBuffer | Buffer | Uint8Array,
): DecodedCsvBytes {
  const bytes: Uint8Array =
    input instanceof Uint8Array ? input : new Uint8Array(input)

  if (bytes.length === 0) {
    return {
      encoding: 'utf-8',
      text: '',
      replacementCharsCount: 0,
      bomDetected: false,
    }
  }

  // BOM detection — escolhe encoding imediato sem ambiguidade
  if (startsWith(bytes, BOM_UTF8)) {
    const text = new TextDecoder('utf-8').decode(bytes.slice(3))
    return {
      encoding: 'utf-8',
      text,
      replacementCharsCount: countReplacementChars(text),
      bomDetected: true,
    }
  }
  if (startsWith(bytes, BOM_UTF16_LE)) {
    const text = new TextDecoder('utf-16le').decode(bytes.slice(2))
    return {
      encoding: 'utf-16le',
      text,
      replacementCharsCount: countReplacementChars(text),
      bomDetected: true,
    }
  }
  if (startsWith(bytes, BOM_UTF16_BE)) {
    const text = new TextDecoder('utf-16be').decode(bytes.slice(2))
    return {
      encoding: 'utf-16be',
      text,
      replacementCharsCount: countReplacementChars(text),
      bomDetected: true,
    }
  }

  // Sem BOM — tenta UTF-8 STRICT (lança em bytes inválidos)
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return {
      encoding: 'utf-8',
      text,
      replacementCharsCount: 0,
      bomDetected: false,
    }
  } catch {
    // Bytes inválidos pra UTF-8. Tenta novamente em modo lenient pra contar
    // replacement chars (orientar logs/UI), aí compara com Windows-1252.
  }

  const utf8Lenient = new TextDecoder('utf-8').decode(bytes)
  const utf8Replacements = countReplacementChars(utf8Lenient)

  // Limite: amostra dos primeiros 4KB. Se >1% replacement chars → ANSI provável.
  const sampleLen = Math.min(4096, bytes.length)
  const sampleRatio = utf8Replacements / Math.max(sampleLen, 1)

  if (sampleRatio > 0.01) {
    // Windows-1252 (cp1252) — alias do Latin1 estendido. Aceita TODOS os bytes
    // 0x00-0xFF, então nunca gera replacement chars. Apropriado pra Excel BR.
    const text = new TextDecoder('windows-1252').decode(bytes)
    return {
      encoding: 'windows-1252',
      text,
      replacementCharsCount: 0,
      bomDetected: false,
    }
  }

  // Pouquíssimos replacement chars → mantém UTF-8 lenient
  return {
    encoding: 'utf-8',
    text: utf8Lenient,
    replacementCharsCount: utf8Replacements,
    bomDetected: false,
  }
}
